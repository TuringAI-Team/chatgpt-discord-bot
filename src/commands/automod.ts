import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { isPremium } from "src/modules/premium";

export default {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Get the command list of the bot")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("enable")
        .setDescription("Enable the automod")
        .addStringOption((option) =>
          option
            .setName("features")
            .setDescription("The features to enable")
            .setRequired(false)
            .addChoices(
              {
                name: "Anti toxicity",
                value: "anti-toxicity",
              },
              {
                name: "Anti invite links",
                value: "anti-invite-links",
              }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("disable")
        .setDescription("Disable the automod")
        .addStringOption((option) =>
          option
            .setName("features")
            .setDescription("The features to enable")
            .setRequired(false)
            .addChoices(
              {
                name: "Anti toxicity",
                value: "anti-toxicity",
              },
              {
                name: "Anti invite links",
                value: "anti-invite-links",
              }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("config")
        .setDescription("Configure the automod")
        // exclude channels:
        .addChannelOption((option) =>
          option
            .setName("exclude-channels")
            .setDescription("Exclude channels from the automod")
            .setRequired(false)
        )
        // exclude roles
        .addRoleOption((option) =>
          option
            .setName("exclude-roles")
            .setDescription("Exclude roles from the automod")
            .setRequired(false)
        )
        // log channel
        .addChannelOption((option) =>
          option
            .setName("log-channel")
            .setDescription("The channel to log the automod actions")
            .setRequired(false)
        )
        // actions
        .addStringOption((option) =>
          option
            .setName("actions")
            .setDescription("The actions to take when a user breaks the rules")
            .setRequired(false)
            .addChoices(
              {
                name: "Warn",
                value: "warn",
              },
              {
                name: "Mute",
                value: "mute",
              },
              {
                name: "Kick",
                value: "kick",
              },
              {
                name: "Ban",
                value: "ban",
              }
            )
        )
    ),
  async execute(interaction, client, commands, commandType) {
    // under development
    await commandType.reply(interaction, {
      content: "This command is under development",
      ephemeral: true,
    });
    return;

    if (interaction.guildId == null) {
      await commandType.reply(
        interaction,
        "This command is only available in servers"
      );
      return;
    }
    // only for premium servers
    var ispremium = await isPremium(null, interaction.guild.id);
    if (!ispremium) {
      await commandType.reply(interaction, {
        content:
          "This command is premium(servers) only, to get premium use the command `/premium buy`",
        ephemeral: true,
      });
      return;
    }
    var subcommand = interaction.options.getSubcommand();
    if (subcommand == "enable") {
      var features = interaction.options.getString("features");
      if (features == "anti-toxicity") {
        await commandType.reply(interaction, {
          content: "Anti toxicity is already enabled",
          ephemeral: true,
        });
        return;
      }
      if (features == "anti-invite-links") {
        await commandType.reply(interaction, {
          content: "Anti invite links is already enabled",
          ephemeral: true,
        });
        return;
      }
    }
    if (subcommand == "disable") {
      var features = interaction.options.getString("features");
      if (features == "anti-toxicity") {
        await commandType.reply(interaction, {
          content: "Anti toxicity is already disabled",
          ephemeral: true,
        });
        return;
      }
      if (features == "anti-invite-links") {
        await commandType.reply(interaction, {
          content: "Anti invite links is already disabled",
          ephemeral: true,
        });
        return;
      }
    }
    if (subcommand == "config") {
      var excludeChannels = interaction.options.getChannel("exclude-channels");
      var excludeRoles = interaction.options.getRole("exclude-roles");
      if (excludeChannels == null && excludeRoles == null) {
        await commandType.reply(interaction, {
          content: "Please provide the features to configure",
          ephemeral: true,
        });
        return;
      }
      if (excludeChannels != null) {
        await commandType.reply(interaction, {
          content: "Excluded channels from the automod",
          ephemeral: true,
        });
        return;
      }
      if (excludeRoles != null) {
        await commandType.reply(interaction, {
          content: "Excluded roles from the automod",
          ephemeral: true,
        });
        return;
      }
    }
  },
};
