import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { sendRconCommand, isRconConfigured } from "../lib/rcon.js";
import { brand } from "../lib/branding.js";

const COOLDOWN_MS = 15_000;
const lastUsedByUser = new Map();

export const data = new SlashCommandBuilder()
  .setName("announce")
  .setDescription("Broadcast a message to everyone in-game")
  .addStringOption((opt) =>
    opt
      .setName("message")
      .setDescription("What to announce (e.g. \"heading to fight the Elder, join me!\")")
      .setRequired(true)
      .setMaxLength(150),
  );

// The console chains commands on ";" and parses "<...>" as live rich-text
// markup, so both must be stripped from free-text user input before it's
// interpolated into the RCON command string.
function sanitize(message) {
  return message.replace(/[;<>]/g, "").trim();
}

export async function execute(interaction) {
  if (!isRconConfigured()) {
    await interaction.reply({
      content: "In-game announcements aren't configured on this server yet.",
      ephemeral: true,
    });
    return;
  }

  const lastUsed = lastUsedByUser.get(interaction.user.id);
  if (lastUsed && Date.now() - lastUsed < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastUsed)) / 1000);
    await interaction.reply({
      content: `Slow down — try again in ${remaining}s.`,
      ephemeral: true,
    });
    return;
  }

  const rawMessage = interaction.options.getString("message", true);
  const message = sanitize(rawMessage);
  if (!message) {
    await interaction.reply({ content: "That message is empty after sanitizing.", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const displayName = sanitize(interaction.member?.displayName ?? interaction.user.username);
  const rconText = `<color=#FFD966><b>${displayName}</b></color>: ${message}`;

  try {
    await sendRconCommand(`broadcast center ${rconText}`);
  } catch (err) {
    console.error("Failed to send RCON broadcast:", err);
    await interaction.editReply({
      content: "Couldn't reach the game server to send that — is it online?",
    });
    return;
  }

  lastUsedByUser.set(interaction.user.id, Date.now());

  const embed = brand(new EmbedBuilder(), interaction.client)
    .setTitle("📣 Announced In-Game")
    .setColor(0xffd966)
    .setDescription(`**${displayName}**: ${message}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
