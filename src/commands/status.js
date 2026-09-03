import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { buildStatusEmbed } from "../lib/statusCard.js";

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Check whether the Vikea Valheim server is online");

export const refreshRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("status_refresh")
    .setLabel("Refresh")
    .setEmoji("🔄")
    .setStyle(ButtonStyle.Secondary),
);

export async function execute(interaction) {
  await interaction.deferReply();
  const embed = await buildStatusEmbed(interaction);
  await interaction.editReply({ embeds: [embed], components: [refreshRow] });
}
