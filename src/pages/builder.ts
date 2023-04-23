import {
    Message,
    GuildMember,
    ButtonStyle,
    EmbedBuilder,
    ButtonBuilder,
    ComponentType,
    MessageEditOptions,
    ColorResolvable,
    ButtonComponent,
    ActionRowBuilder,
    AnyComponentBuilder,
    SelectMenuComponent,
    InteractionCollector,
    InteractionReplyOptions,
    MessageComponentInteraction,
    ChatInputCommandInteraction,
    MessageActionRowComponentBuilder,
    InteractionEditReplyOptions,
    Routes
} from 'discord.js';
import { APIMessage } from 'discord-api-types/v10';

import {
    Page,
    Action,
    Button,
    Trigger,
    EndMethod,
    ActionLabel,
    ActionUnion,
    TriggersMap,
    EndMethodUnion,
    ActionLabelUnion,
    AutoGeneratePagesOptions,
    ResetListenTimeoutOptions, AllowArray
} from './types/index.js';

import { chunk, mergeDeep } from './utils/index.js';

type Files = Exclude<MessageEditOptions['files'], undefined>;

export class PagesBuilder extends EmbedBuilder {

    /**
     * Common
     */
    readonly interaction: ChatInputCommandInteraction;
    private message!: Message;
    private messageComponent?: MessageComponentInteraction;
    private collector!: InteractionCollector<any>;
    private buildMethod!: 'followUp' | 'editReply' | 'reply';

    /**
     * Pages
     */
    private pages: Page[] = [];
    private files: Files = [];
    private currentPage = 1;
    private paginationFormat = '%c / %m';
    private loop = true;

    /**
     * Components
     */
    protected components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
    private defaultButtons: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

    /**
     * Listen
     */
    private listenTimeout: number = 5 * 60 * 1_000;
    private listenUsers: GuildMember['id'][];
    private timeout!: NodeJS.Timeout;
    private autoResetTimeout = true;
    private endColor: ColorResolvable = 'Grey';
    private endMethod: EndMethod | EndMethodUnion = EndMethod.EDIT;

    /**
     * Triggers
     */
    private triggers: TriggersMap = new Map();

    constructor(interaction: ChatInputCommandInteraction) {
        super();

        this.interaction = interaction;
        this.listenUsers = [ interaction.user.id ];

        this.setDefaultButtons();
    }

    /**
     * Method for initial pages setup
     *
     * @example
     * ```
     * builder.setPages(
     *     new Embed()
     *         .setTitle('Hello World!')
     * );
     *
     * builder.setPages([
     *     new Embed()
     *         .setTitle('Hello World!'),
     *     () => (
     *         new Embed()
     *             .setTitle('Function page')
     *     )
     * ]);
     * ```
     */
    setPages(pages: Page | Page[]): this {
        if (!Array.isArray(pages)) {
            pages = [pages];
        }

        this.pages = pages;

        return this;
    }

    /**
     * Method for adding pages to the end
     */
    addPages(pages: Page | Page[]): this {
        this.pages = this.pages.concat(pages);

        return this;
    }

    /**
     * Method for initial files setup
     */
    setFiles(files: Files | Files[number]): this {
        if (!Array.isArray(files)) {
            files = [files];
        }

        this.files = files;

        return this;
    }

    /**
     * Method for adding files to the end
     */
    addFiles(files: Files | Files[number]): this {
        this.files = this.files.concat(files);

        return this;
    }

    /**
     * Method for auto generating pages
     *
     * @example
     * ```
     * builder.autoGeneratePages({
     *     items: [
     *         'Player 1',
     *         'Player 2',
     *         'Player 3'
     *     ],
     *     countPerPage: 2
     * });
     * ```
     */
    autoGeneratePages({ items, countPerPage = 10 }: AutoGeneratePagesOptions): this {
        const chunks = chunk(items, countPerPage);

        this.setPages(
            chunks.map((chunk) => (
                new EmbedBuilder()
                    .setDescription(
                        chunk.join('\n')
                    )
            ))
        );

        return this;
    }

    /**
     * Method for opening a specific page
     */
    async setPage(pageNumber: number): Promise<ReturnType<PagesBuilder['editReply']>> {
        this.currentPage = pageNumber;

        const data: InteractionEditReplyOptions = {
            embeds: await this.getPage(pageNumber),
            components: this.simplifyKeyboard([
                ...this.defaultButtons,
                ...this.components
            ])
        };

        return this.editReply(data);
    }

    /**
     * Method for edit current reply
     *
     * @hidden
     */
    private editReply(data: InteractionEditReplyOptions): ReturnType<Message['edit']>
        | ReturnType<ChatInputCommandInteraction['editReply']>
        | ReturnType<MessageComponentInteraction['editReply']>
        | ReturnType<MessageComponentInteraction['update']> {
        if (this.messageComponent) {
            const method = this.messageComponent.deferred || this.messageComponent.replied ?
                'editReply'
                :
                'update';

            return this.messageComponent[method](data);
        }

        if (this.buildMethod !== 'reply') {
            return this.message.edit(data);
        }

        return this.interaction.editReply(data);
    }

    /**
     * Method for getting the page
     */
    async getPage(pageNumber: number = this.currentPage): Promise<EmbedBuilder[]> {
        let page: Page = this.pages[pageNumber - 1];

        if (typeof page === 'function') {
            page = await page();
        }

        const resultPage = new EmbedBuilder(
            mergeDeep(this.toJSON(), page.toJSON())
        );

        if (this.paginationFormat) {
            const pageNumber = this.paginationFormat
                .replace('%c', String(this.currentPage))
                .replace('%m', String(this.pages.length));

            const footerText = resultPage.data.footer?.text || '';

            resultPage.setFooter({
                ...resultPage.data.footer,
                text: `${pageNumber}${pageNumber && footerText ? ' • ' : ''}${footerText}`
            });
        }

        return [resultPage];
    }

    /**
     * Method for setting the pagination format
     *
     * @example
     * %c - Current page
     * %m - Max page
     *
     * ```
     * builder.setPaginationFormat('Current page: %c, Max: %m');
     * ```
     */
    setPaginationFormat(format = '%c / %m'): this {
        this.paginationFormat = format;

        return this;
    }

    /**
     * Method for setting endless page switching when reaching the end
     */
    setLoop(status = true): this {
        this.loop = status;

        return this;
    }

    /**
     * Method for setting default buttons
     *
     * @example
     * ```
     * builder.setDefaultButtons(['first', {
     *   stop: new ButtonComponent()
     *      .setLabel('Stop')
     *      .setStyle('PRIMARY')
     * }]);
     * ```
     */
    setDefaultButtons(buttons: Button[] = [ Action.BACK, Action.STOP, Action.NEXT ]): this {
        const defaultActions = new Map<Action | ActionUnion, ActionLabel | ActionLabelUnion>([
            [Action.FIRST, ActionLabel.FIRST],
            [Action.BACK, ActionLabel.BACK],
            [Action.STOP, ActionLabel.STOP],
            [Action.NEXT, ActionLabel.NEXT],
            [Action.LAST, ActionLabel.LAST]
        ]);

        this.defaultButtons = buttons.length ?
            [
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        buttons.map((button: Button) => {
                            if (typeof button === 'string') {
                                return new ButtonBuilder()
                                    .setCustomId(button)
                                    .setEmoji(defaultActions.get(button) as ActionUnion)
                                    .setStyle(ButtonStyle.Secondary);
                            }

                            const [[buttonAction, buttonComponent]] = Object.entries(button);

                            return buttonComponent
                                .setCustomId(buttonAction);
                        })
                    )
            ]
            :
            [];

        return this;
    }

    /**
     * Method for setting the time to listen for updates to switch pages
     */
    setListenTimeout(timeout = 5 * 60 * 1_000): this {
        this.listenTimeout = timeout;

        return this;
    }

    /**
     * @description Method for resetting the current listening timer
     */
    resetListenTimeout({ isFirstBuild = false }: ResetListenTimeoutOptions = {}): void {
        if (this.timeout || isFirstBuild) {
            clearTimeout(this.timeout as NodeJS.Timeout);

            this.timeout = setTimeout(this.stopListen.bind(this), this.listenTimeout);
        }
    }

    /**
     * Method for setting embed color at the end of listening
     */
    setListenEndColor(color: ColorResolvable = 'Grey'): this {
        this.endColor = color;

        return this;
    }

    /**
     * Method for setting the method of working with a message when you finish listening for reactions
     */
    setListenEndMethod(method: EndMethod | EndMethodUnion): this {
        this.endMethod = method;

        return this;
    }

    /**
     * Method for setting listening to specific users
     */
    setListenUsers(users: AllowArray<GuildMember['id']> = []): this {
        this.listenUsers = !Array.isArray(users) ? [users] : users;

        return this;
    }

    /**
     * Method for adding listening to specific users
     */
    addListenUsers(users: AllowArray<GuildMember['id']>): this {
        this.listenUsers = this.listenUsers.concat(users);

        return this;
    }

    /**
     * Method for setting the timer to automatically reset when switching between pages
     */
    setAutoResetTimeout(status = true): this {
        this.autoResetTimeout = status;

        return this;
    }

    /**
     * Method for early stopping listening
     */
    stopListen(): void {
        if (this.timeout) {
            clearTimeout(this.timeout);

            this.collector.stop();
        }
    }

    /**
     * Method for setting components rows
     */
    setComponents(
        components: AllowArray<ActionRowBuilder<MessageActionRowComponentBuilder>>
    ): this {
        if (!Array.isArray(components)) {
            components = [components];
        }

        this.components = components;

        return this;
    }

    /**
     * Method for adding components to available row
     */
    addComponents(
        components:
            AllowArray<
                ActionRowBuilder<MessageActionRowComponentBuilder>
                | MessageActionRowComponentBuilder
                >
    ): this {
        if (!Array.isArray(components)) {
            components = [components];
        }

        components.forEach((component) => {
            if (component instanceof ActionRowBuilder) {
                return this.components.push(component);
            }

            let length = this.components.length;

            if (!length) {
                this.components.push(
                    new ActionRowBuilder()
                );

                length++;
            }

            const row = this.components[length - 1];

            if (
                component.data.type !== ComponentType.SelectMenu &&
                row.components.length < 5 &&
                row.components.findIndex(({ data: { type } }) => type === ComponentType.SelectMenu) === -1
            ) {
                row.addComponents(component);
            } else {
                this.components.push(
                    new ActionRowBuilder<MessageActionRowComponentBuilder>()
                        .addComponents(component)
                );
            }
        });

        return this;
    }

    /**
     * Method for update existing components
     *
     * @example
     * ```
     * const button = new ButtonComponent()
     *    .setCustomId('test')
     *    .setLabel('Test button')
     *    .setStyle('PRIMARY');
     *
     * builder.addComponents(button);
     *
     * button.setLabel('Primary button');
     *
     * builder.updateComponents(button);
     *
     * builder.rerender();
     * ```
     */
    updateComponents(rows: AllowArray<ActionRowBuilder<MessageActionRowComponentBuilder>>): this {
        if (!Array.isArray(rows)) {
            rows = [rows];
        }

        rows.forEach((component) => {
            this.components = this.components.map((row) => {
                // @ts-ignore
                const index = row.components.findIndex(({ data: { custom_id } }) => custom_id === component.data?.custom_id);

                if (index !== -1) {
                    row.components.splice(index, 1, ...component.components);
                }

                return row;
            });
        });

        return this;
    }

    get appendedComponents(): PagesBuilder['components'] {
        return this.components;
    }

    /**
     * Method for initial setting of triggers
     */
    setTriggers<T extends ButtonComponent | SelectMenuComponent>(triggers: Trigger<T> | Trigger<T>[] = []): this {
        if (!Array.isArray(triggers)) {
            triggers = [triggers];
        }

        this.triggers = new Map(
            triggers.map(({ name, callback }) => [name, callback])
        );

        return this;
    }

    /**
     * Method for adding triggers
     */
    addTriggers<T extends ButtonComponent | SelectMenuComponent>(triggers: Trigger<T> | Trigger<T>[]): this {
        if (!Array.isArray(triggers)) {
            triggers = [triggers];
        }

        triggers.forEach(({ name, callback }) => (
            this.triggers.set(name, callback)
        ));

        return this;
    }

    /**
     * Rerender current page
     */
    rerender(): Promise<any> {
        return this.setPage(this.currentPage);
    }

    /**
     * Build method
     */
    async build(options: Pick<InteractionReplyOptions, 'ephemeral'> = {}): Promise<void | Message | APIMessage> {
        if (this.pages.length === 0) {
            throw new TypeError('Pages not set');
        }

        const method = this.interaction.replied ?
            'followUp'
            :
            this.interaction.deferred ?
                'editReply'
                :
                'reply';

        const response = await this.interaction[method]({
            embeds: await this.getPage(),
            files: this.files,
            components: this.simplifyKeyboard([
                ...this.defaultButtons,
                ...this.components
            ]),
            fetchReply: true,
            ...options
        })
            .then((message) => {
                this.message = message as Message;
            });

        this.buildMethod = method;

        this.startCollector();
        this.resetListenTimeout({
            isFirstBuild: true
        });

        return response;
    }

    /**
     * @hidden
     */
    private simplifyKeyboard(rows: ActionRowBuilder<MessageActionRowComponentBuilder>[]): ReturnType<ActionRowBuilder<MessageActionRowComponentBuilder>['toJSON']>[] {
        if (this.loop && this.pages.length > 1) {
            return rows
                .map((row) => (
                    row.toJSON()
                ));
        }

        return rows.reduce<ReturnType<ActionRowBuilder<MessageActionRowComponentBuilder>['toJSON']>[]>((rows, row) => {
            const components = row.components.filter(({ data }) => {
                // @ts-ignore
                const { type, custom_id } = data!;

                return (
                    type !== ComponentType.Button ||
                    (
                        this.currentPage !== 1 ||
                        this.pages.length !== 1 ||
                        (custom_id !== Action.FIRST && custom_id !== Action.BACK)
                    ) &&
                    (
                        this.currentPage !== this.pages.length ||
                        this.pages.length !== 1 ||
                        (custom_id !== Action.LAST && custom_id !== Action.NEXT)
                    )
                );
            });

            row = new ActionRowBuilder<MessageActionRowComponentBuilder>({
                ...row,
                components
            });

            if (row.components.length) {
                rows.push(
                    row.toJSON()
                );
            }

            return rows;
        }, []);
    }

    /**
     * @hidden
     */
    private startCollector(): void {
        this.collector = this.message.createMessageComponentCollector()
            .on('collect', (event) => {
                if (event.message?.id !== this.message.id) {
                    return;
                }

                if (
                    this.listenUsers.length &&
                    !this.listenUsers.includes(event.user.id!)
                ) {
                    return;
                }

                if (this.autoResetTimeout) {
                    this.resetListenTimeout();
                }

                this.messageComponent = event;
                this.message = event.message as Message;

                if (event.isButton()) {
                    this.handleButton(event);
                }

                if (event.isStringSelectMenu()) {
                    this.handleSelectMenuComponent(event);
                }
            })
            .on('end', async () => {
                switch (this.endMethod) {
                    case EndMethod.EDIT: {
                        const embeds = await this.getPage();

                        const [embed] = embeds;

                        embed.setColor(this.endColor);

                        this.editReply({
                            embeds,
                            components: []
                        });
                        break;
                    }
                    case EndMethod.REMOVE_COMPONENTS:
                        this.editReply({
                            components: []
                        })
                            .catch(() => null);
                        break;
                    case EndMethod.REMOVE_EMBEDS:
                        this.editReply({
                            embeds: []
                        })
                            .catch(() => null);
                        break;
                    case EndMethod.DELETE:
                        await this.message.client.rest.delete(Routes.channelMessage(this.message.channelId, this.message.id))
                            .catch(() => null);
                        break;
                }
            });
    }

    /**
     * @hidden
     */
    private async handleButton(interaction: MessageComponentInteraction): Promise<void> {
        const { customId } = interaction;

        this.executeAction(customId);

        const trigger = this.triggers.get(customId);
        const buttons: AnyComponentBuilder[] = [];

        if (trigger) {
            this.components.forEach((component) => {
                component.components.forEach((button) => {
                    // @ts-ignore
                    if (button.data?.custom_id === customId) {
                        buttons.push(button);
                    }
                });
            });

            await interaction.deferUpdate();
            await trigger(interaction, ...buttons);
            this.rerender();
        }
    }

    /**
     * @hidden
     */
    private async handleSelectMenuComponent(interaction: MessageComponentInteraction): Promise<void> {
        const { customId } = interaction;

        const trigger = this.triggers.get(customId);
        const menu: AnyComponentBuilder[] = [];

        if (trigger) {
            this.components.forEach((component) => {
                component.components.forEach((component) => {
                    // @ts-ignore
                    if (component.data?.custom_id === customId) {
                        menu.push(component);
                    }
                });
            });

            await interaction.deferUpdate();

            await trigger(interaction, ...menu);
        }
    }

    /**
     * Method for invoking quick actions
     */
    executeAction(action: Action | ActionUnion | string): void {
        switch (action) {
            case Action.FIRST:
                if (this.currentPage === 1) {
                    if (this.loop) {
                        this.setPage(this.pages.length);
                    }

                    return;
                }

                this.setPage(1);
                break;
            case Action.BACK:
                if (this.currentPage === 1) {
                    if (this.loop) {
                        this.setPage(this.pages.length);
                    }

                    return;
                }

                this.setPage(this.currentPage - 1);
                break;
            case Action.STOP:
                this.stopListen();
                break;
            case Action.NEXT:
                if (this.currentPage === this.pages.length) {
                    if (this.loop) {
                        this.setPage(1);
                    }

                    return;
                }

                this.setPage(this.currentPage + 1);
                break;
            case Action.LAST:
                if (this.currentPage === this.pages.length) {
                    if (this.loop) {
                        this.setPage(1);
                    }

                    return;
                }

                this.setPage(this.pages.length);
                break;
        }
    }
}
