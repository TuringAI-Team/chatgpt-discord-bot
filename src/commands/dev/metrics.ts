import { ActionRow, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonComponent, ButtonInteraction, ButtonStyle, MessageEditOptions, SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { MetricsChart, MetricsCharts, TuringChartResult } from "../../turing/api.js";
import { InteractionHandlerResponse } from "../../interaction/handler.js";
import { LoadingIndicatorManager } from "../../db/types/indicator.js";
import { NoticeResponse } from "../../command/response/notice.js";
import { ErrorResponse } from "../../command/response/error.js";
import { DatabaseInfo } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Bot } from "../../bot/bot.js";

interface ChartTimeFrame {
	name: string;
}

export const TIME_FRAME_OPTIONS: ChartTimeFrame[] = [
	{ name: "1d" }, { name: "1w" }, { name: "2w" }
]

interface MetricsChartBuilderOption {
	chart: MetricsChart;
	time: ChartTimeFrame;
}

export default class MetricsCommand extends Command {
    constructor(bot: Bot) {
        super(bot, new SlashCommandBuilder()
			.setName("metrics")
			.setDescription("View information about metrics")
			.addSubcommand(builder => builder
				.setName("save")
				.setDescription("Save all pending metrics to the database")
			)
			.addSubcommand(builder => builder
				.setName("view")
				.setDescription("View all metrics in charts")
				.addStringOption(builder => builder
					.setName("which")
					.setDescription("Which chart to view")
					.addChoices(...MetricsCharts.map(chart => ({
						name: chart.description,
						value: chart.name
					})))
				)
				.addStringOption(builder => builder
					.setName("time")
					.setDescription("Which time frame to view the charts in")
					.addChoices(...TIME_FRAME_OPTIONS.map(t => ({
						name: t.name,
						value: t.name
					})))
				)
			)
		, { restriction: [ "owner", "investor", "advertiser" ] });
    }

	public async fetchChart({ chart, time }: MetricsChartBuilderOption): Promise<TuringChartResult> {
		return await this.bot.turing.chart({
			settings: {
				period: time.name,
				...chart.settings
			},

			chart
		});
	}

    public buildPageSwitcher({ chart }: MetricsChartBuilderOption): ActionRowBuilder<ButtonBuilder> {
        /* Current chart index */
        const currentIndex: number = MetricsCharts.findIndex(c => c.name === chart.name);

        /* Page switcher row builder */
        const row = new ActionRowBuilder<ButtonBuilder>();

        row.addComponents(
            new ButtonBuilder()
                .setEmoji("◀️").setStyle(ButtonStyle.Secondary)
                .setCustomId("metrics:page:-1")
                .setDisabled(currentIndex - 1 < 0),

            new ButtonBuilder()
                .setCustomId(`metrics:refresh:${chart.name}`)
                .setStyle(ButtonStyle.Success).setEmoji("🔄"),

            new ButtonBuilder()
                .setEmoji("▶️").setStyle(ButtonStyle.Secondary)
                .setCustomId("metrics:page:1")
                .setDisabled(currentIndex + 1 > MetricsCharts.length - 1)
        );

        return row;
    }

	public buildPageControls({ time }: MetricsChartBuilderOption): ActionRowBuilder<ButtonBuilder> {
        const row = new ActionRowBuilder<ButtonBuilder>();

        row.addComponents(
			...TIME_FRAME_OPTIONS.map(t => new ButtonBuilder()
				.setLabel(t.name)
				.setCustomId(`metrics:time:${t.name}`)
				.setStyle(time.name === t.name ? ButtonStyle.Success : ButtonStyle.Secondary)
				.setDisabled(time.name === t.name)
			)
        );

        return row;
	}
	
	public buildLoadingIndicator(db: DatabaseInfo): Response {
		/* The user's loading indicator */
		const loadingEmoji: string = LoadingIndicatorManager.toString(
			LoadingIndicatorManager.getFromUser(this.bot, db.user)
		);

		return new Response()
			.addEmbed(builder => builder
				.setColor(this.bot.branding.color)
				.setDescription(`**Loading** ... ${loadingEmoji}`)	
			);
	}

    public async buildPage({ chart, time }: MetricsChartBuilderOption): Promise<Response> {
        /* Page switcher row */
        const switcher = this.buildPageSwitcher({ chart, time });
		const controls = this.buildPageControls({ chart, time });

		/* Fetch the actual chart. */
		const result = await this.fetchChart({ chart, time });

		/* Last save time */
		const lastResetAt: number | null = await this.bot.db.metrics.lastResetAt();

        /* Final response */
        const response: Response = new Response()
			.addEmbed(builder => builder
				.setImage("attachment://chart.png")
				.setTitle(`${chart.description} 📊`)
				.setColor(this.bot.branding.color)
				.setTimestamp(lastResetAt)
			)
			.addAttachment(new AttachmentBuilder(result.image.buffer)
				.setName("chart.png")
			);

        return response
			.addComponent(ActionRowBuilder<ButtonBuilder>, switcher)
			.addComponent(ActionRowBuilder<ButtonBuilder>, controls);
    }

	public async handleInteraction(interaction: ButtonInteraction, db: DatabaseInfo, data: string[]): InteractionHandlerResponse {
        /* Type of settings action */
        const type: "page" | "refresh" | "time" = data.shift()! as any;

		if (interaction.user.id !== interaction.message.interaction?.user.id) return void await new ErrorResponse({
			interaction, message: `This chart menu doesn't belong to you; run \`/metrics view\` to use it yourself`, emoji: "😔"
		}).send(interaction);

        const chartType: string = (interaction.message.components[0] as ActionRow<ButtonComponent>)
            .components[1].customId!.split(":").pop()!;

        /* Current chart category & index */
        const chart: MetricsChart | null = MetricsCharts.find(m => m.name === chartType) ?? null;
        const chartIndex: number = MetricsCharts.findIndex(m => m.name === chartType);

		/* Current time frame */
        const timeFrame: string | null = (interaction.message.components[1] as ActionRow<ButtonComponent>)
            .components.filter(c => c.style === ButtonStyle.Success)
			.map(c => c.customId!.split(":").pop()!)[0] ?? null;

        if (chart === null || timeFrame === null) return;

		/* Selected time frame */
		const time: ChartTimeFrame = TIME_FRAME_OPTIONS.find(t => t.name === timeFrame)!;

        /* Change the page */
        if (type === "page" || type === "time" || type === "refresh") {
			let newChart: MetricsChart | null = null;
			let newTime: ChartTimeFrame | null = null;

			if (type === "page") {
				/* How to switch the pages, either -1 or (+)1 */
				const delta: number = parseInt(data.shift()!);

				newChart = MetricsCharts.at(chartIndex + delta) ?? null;
				if (newChart === null) return;

			} else if (type === "time") {
				const newTimeFrame: string = interaction.customId.split(":").pop()!;

				newTime = TIME_FRAME_OPTIONS.find(t => t.name === newTimeFrame) ?? null;
				if (newTime === null) return;
			}

			await interaction.deferUpdate();

			await interaction.message.edit(
				this.buildLoadingIndicator(db).get() as MessageEditOptions
			);

			const page = await this.buildPage({
                chart: newChart ?? chart, time: newTime ?? time
            });
            
            await interaction.message.edit(page.get() as MessageEditOptions);
		}
	}

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		if (!this.bot.app.config.metrics) return new ErrorResponse({
			interaction, command: this, message: "Metrics are disabled"
		});

		/* Action to execute */
		const action: "save" | "view" = interaction.options.getSubcommandGroup(false) ?? interaction.options.getSubcommand(true) as any;

		/* Save all pending metrics to the database */
		if (action === "save") {
			await this.bot.db.metrics.save();

			return new NoticeResponse({
				message: "Done 🙏", color: "Orange"
			});

		/* View all pending metrics */
		} else if (action === "view") {
			/* Name of the chart to view */
			const metricName: string | null = interaction.options.getString("which", false);
			const metric: MetricsChart = metricName !== null ? MetricsCharts.find(c => c.name === metricName)! : MetricsCharts[0];

			/* Time period to display */
			const time: ChartTimeFrame = interaction.options.getString("time", false) ?
				{ name: interaction.options.getString("time", true) }
				: TIME_FRAME_OPTIONS[0];

			await this.buildLoadingIndicator(db).send(interaction);

			return this.buildPage({
				chart: metric, time
			});
		}
    }
}