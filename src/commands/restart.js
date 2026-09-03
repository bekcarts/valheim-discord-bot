import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { restartService, getServiceState } from "../lib/systemd.js";
import {
  getLastRestartRequestAt,
  setLastRestartRequestAt,
  isRestartInProgress,
  setRestartInProgress,
} from "../lib/state.js";
import { startRestart, isCancelled, clearRestart } from "../lib/restartControl.js";
import { brand, ANSI, ansiBlock } from "../lib/branding.js";

const SERVICE_NAME = process.env.SERVICE_NAME || "valheim-vikea.service";
const COOLDOWN_MINUTES = parseInt(process.env.RESTART_COOLDOWN_MINUTES || "15", 10);
const COUNTDOWN_MINUTES = parseInt(process.env.RESTART_COUNTDOWN_MINUTES || "5", 10);
const ALLOWED_ROLE_IDS = (process.env.ALLOWED_ROLE_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const data = new SlashCommandBuilder()
  .setName("restart")
  .setDescription(`Restart the Vikea server after a ${COUNTDOWN_MINUTES}-minute warning`);

export function hasPermission(interaction) {
  if (ALLOWED_ROLE_IDS.length === 0) return true;
  return interaction.member.roles.cache.some((role) => ALLOWED_ROLE_IDS.includes(role.id));
}

function minutesRemaining(since, cooldownMinutes) {
  const elapsedMs = Date.now() - since.getTime();
  const remainingMs = cooldownMinutes * 60_000 - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / 60_000));
}

const cancelRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("restart_cancel")
    .setLabel("Cancel Restart")
    .setEmoji("❌")
    .setStyle(ButtonStyle.Danger),
);

function countdownEmbed(interaction, minutesLeft, requestedBy) {
  const isFinal = minutesLeft <= 0;
  const statusWord = isFinal ? "🔴 **Restarting Now**" : "🟠 **Restart Scheduled**";
  const timeText = isFinal ? "NOW" : `${minutesLeft} MIN${minutesLeft === 1 ? "" : "S"}`;
  const timeBlock = `**Time Remaining**\n${ansiBlock(timeText, isFinal ? ANSI.boldRed : ANSI.boldYellow)}`;
  const noteLine = isFinal
    ? `Requested by ${requestedBy}`
    : `Requested by ${requestedBy}\nSave what you're doing and get somewhere safe.`;

  return brand(new EmbedBuilder(), interaction)
    .setTitle("🛡️ Vikea — Valheim Server")
    .setColor(0xfaa61a)
    .setDescription(`${statusWord}\n\n${timeBlock}\n${noteLine}`)
    .setTimestamp();
}

export function cancelledEmbed(interaction, requestedBy, cancelledBy) {
  return brand(new EmbedBuilder(), interaction)
    .setTitle("🛡️ Vikea — Valheim Server")
    .setColor(0x99aab5)
    .setDescription(
      `⚪ **Restart Cancelled**\n\nRestart requested by ${requestedBy} was cancelled by ${cancelledBy}.`,
    )
    .setTimestamp();
}

function resultEmbed(interaction, success, requestedBy) {
  const statusWord = success ? "✅ **Server Back Online**" : "⚠️ **Still Coming Back Online**";
  const note = success
    ? `Requested by ${requestedBy}.`
    : `Restart command was sent, but the server hasn't come back up yet. Check \`/status\` or the host directly.\nRequested by ${requestedBy}.`;

  return brand(new EmbedBuilder(), interaction)
    .setTitle("🛡️ Vikea — Valheim Server")
    .setColor(success ? 0x57f287 : 0xed4245)
    .setDescription(`${statusWord}\n\n${note}`)
    .setTimestamp();
}

export async function execute(interaction) {
  if (!hasPermission(interaction)) {
    await interaction.reply({
      content: "You don't have permission to restart the server.",
      ephemeral: true,
    });
    return;
  }

  if (isRestartInProgress()) {
    await interaction.reply({
      content: "A restart is already counting down.",
      ephemeral: true,
    });
    return;
  }

  const lastRequestAt = await getLastRestartRequestAt();
  if (lastRequestAt) {
    const remaining = minutesRemaining(lastRequestAt, COOLDOWN_MINUTES);
    if (remaining > 0) {
      await interaction.reply({
        content: `Restart was requested recently. Try again in ${remaining} minute${
          remaining === 1 ? "" : "s"
        }.`,
        ephemeral: true,
      });
      return;
    }
  }

  const requestedBy = `<@${interaction.user.id}>`;
  await setLastRestartRequestAt(new Date());
  setRestartInProgress(true);
  startRestart(interaction.user.id);

  try {
    await interaction.reply({
      embeds: [countdownEmbed(interaction, COUNTDOWN_MINUTES, requestedBy)],
      components: [cancelRow],
    });

    const totalSeconds = COUNTDOWN_MINUTES * 60;
    let elapsed = 0;
    let lastShown = COUNTDOWN_MINUTES;

    while (elapsed < totalSeconds) {
      await sleep(5_000);
      elapsed += 5;
      if (isCancelled()) break;

      const minutesLeft = Math.ceil((totalSeconds - elapsed) / 60);
      if (minutesLeft !== lastShown) {
        lastShown = minutesLeft;
        await interaction.editReply({
          embeds: [countdownEmbed(interaction, minutesLeft, requestedBy)],
          components: minutesLeft > 0 ? [cancelRow] : [],
        });
      }
    }

    // If cancelled, the button click handler already updated the message —
    // nothing left to do here.
    if (isCancelled()) return;

    await restartService(SERVICE_NAME);

    const cameBackOnline = await waitForOnline(SERVICE_NAME, 3 * 60_000);
    await interaction.editReply({
      embeds: [resultEmbed(interaction, cameBackOnline, requestedBy)],
      components: [],
    });
  } finally {
    setRestartInProgress(false);
    clearRestart();
  }
}

async function waitForOnline(serviceName, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(5_000);
    const state = await getServiceState(serviceName);
    if (state === "active") return true;
  }
  return false;
}
