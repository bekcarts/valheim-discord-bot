import "dotenv/config";
import { Client, GatewayIntentBits, Collection, EmbedBuilder } from "discord.js";
import * as status from "./commands/status.js";
import * as restart from "./commands/restart.js";
import * as info from "./commands/info.js";
import { buildStatusEmbed } from "./lib/statusCard.js";
import {
  isCancelled,
  getRequesterId,
  getCancelledById,
  cancelRestart,
} from "./lib/restartControl.js";
import { checkAndClearCrashFlag } from "./lib/crashFlag.js";
import { brand } from "./lib/branding.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
for (const command of [status, restart, info]) {
  client.commands.set(command.data.name, command);
}

const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID || null;
const CRASH_ALERT_ROLE_ID = process.env.CRASH_ALERT_ROLE_ID || null;
const CRASH_CHECK_INTERVAL_MS = 15_000;

async function checkForCrash() {
  const crashed = await checkAndClearCrashFlag();
  if (!crashed || !ALLOWED_CHANNEL_ID) return;

  try {
    const channel = await client.channels.fetch(ALLOWED_CHANNEL_ID);
    const embed = brand(new EmbedBuilder(), client)
      .setTitle("🛡️ Vikea — Valheim Server")
      .setColor(0xed4245)
      .setDescription(
        "💥 **Server Crashed**\n\nThe game process failed and is being restarted automatically. Give it a minute, then check `/status`.",
      )
      .setTimestamp();
    await channel.send({
      content: CRASH_ALERT_ROLE_ID ? `<@&${CRASH_ALERT_ROLE_ID}>` : undefined,
      embeds: [embed],
    });
  } catch (err) {
    console.error("Failed to send crash alert:", err);
  }
}

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
  setInterval(checkForCrash, CRASH_CHECK_INTERVAL_MS);
});

function inAllowedChannel(interaction) {
  return !ALLOWED_CHANNEL_ID || interaction.channelId === ALLOWED_CHANNEL_ID;
}

async function handleChatInputCommand(interaction) {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (!inAllowedChannel(interaction)) {
    await interaction.reply({
      content: `Please use this in <#${ALLOWED_CHANNEL_ID}>.`,
      ephemeral: true,
    });
    return;
  }

  await command.execute(interaction);
}

async function handleButton(interaction) {
  if (!inAllowedChannel(interaction)) {
    await interaction.reply({
      content: `Please use this in <#${ALLOWED_CHANNEL_ID}>.`,
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === "status_refresh") {
    await interaction.deferUpdate();
    const embed = await buildStatusEmbed(interaction);
    await interaction.editReply({ embeds: [embed], components: [status.refreshRow] });
    return;
  }

  if (interaction.customId === "restart_cancel") {
    const requesterId = getRequesterId();
    if (!requesterId || isCancelled()) {
      await interaction.reply({ content: "No restart is currently counting down.", ephemeral: true });
      return;
    }

    const canCancel = interaction.user.id === requesterId || restart.hasPermission(interaction);
    if (!canCancel) {
      await interaction.reply({ content: "You can't cancel this restart.", ephemeral: true });
      return;
    }

    cancelRestart(interaction.user.id);
    await interaction.update({
      embeds: [
        restart.cancelledEmbed(interaction, `<@${requesterId}>`, `<@${getCancelledById()}>`),
      ],
      components: [],
    });
  }
}

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    }
  } catch (err) {
    console.error("Error handling interaction:", err);
    const errorReply = { content: "Something went wrong running that command.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorReply).catch(() => {});
    } else {
      await interaction.reply(errorReply).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
