import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getServiceStartTime } from "../lib/systemd.js";
import { getLaunchArgs, getVersionInfo, getModList } from "../lib/serverInfo.js";
import { brand } from "../lib/branding.js";

const SERVICE_NAME = process.env.SERVICE_NAME || "valheim-vikea.service";
const DAY_LENGTH_SECONDS = parseInt(process.env.DAY_LENGTH_SECONDS || "1800", 10);

export const data = new SlashCommandBuilder()
  .setName("info")
  .setDescription("Show the Vikea server's configuration (world, version, mods, etc.)");

export async function execute(interaction) {
  await interaction.deferReply();

  const startTime = await getServiceStartTime(SERVICE_NAME);
  const [launchArgs, versionInfo, mods] = await Promise.all([
    getLaunchArgs(SERVICE_NAME),
    getVersionInfo(SERVICE_NAME, startTime),
    getModList(),
  ]);

  const embed = brand(new EmbedBuilder(), interaction.client)
    .setTitle("🛡️ Vikea — Valheim Server")
    .setColor(0x5865f2)
    .setDescription("ℹ️ **Server Configuration**")
    .setTimestamp();

  if (launchArgs) {
    embed.addFields(
      { name: "World", value: `\`${launchArgs.world ?? "unknown"}\``, inline: true },
      { name: "Port", value: `\`${launchArgs.port ?? "unknown"}\``, inline: true },
      { name: "Crossplay", value: launchArgs.crossplay ? "✅ Enabled" : "❌ Disabled", inline: true },
      {
        name: "Password Protected",
        value: launchArgs.hasPassword ? "🔒 Yes" : "🔓 No",
        inline: true,
      },
      {
        name: "Modifiers",
        value: launchArgs.modifiers.length ? launchArgs.modifiers.join(", ") : "None",
        inline: true,
      },
      {
        name: "Day Length",
        value: `${Math.round(DAY_LENGTH_SECONDS / 60)} min`,
        inline: true,
      },
    );
  } else {
    embed.addFields({ name: "Launch Config", value: "Server isn't running — start it with `/restart`." });
  }

  embed.addFields(
    {
      name: "Valheim Version",
      value: versionInfo.version
        ? `${versionInfo.version} (network v${versionInfo.networkVersion})`
        : "unknown",
      inline: true,
    },
    {
      name: `Mods (${versionInfo.modded ? "BepInEx" : "Vanilla"})`,
      value: mods.length ? mods.join(", ") : "None installed",
      inline: false,
    },
    {
      name: "Connecting",
      value:
        "Join via Valheim's in-game **crossplay/PlayFab** browser using the current join code from `/status` — there's no direct IP to connect to.",
      inline: false,
    },
  );

  await interaction.editReply({ embeds: [embed] });
}
