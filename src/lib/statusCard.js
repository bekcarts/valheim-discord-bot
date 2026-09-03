import { EmbedBuilder } from "discord.js";
import { getServiceState, getServiceStartTime } from "./systemd.js";
import { readLiveState, getLastSaveTime, describeWorldDay } from "./gamelog.js";
import { brand, ANSI, ansiBlock } from "./branding.js";

const SERVICE_NAME = process.env.SERVICE_NAME || "valheim-vikea.service";
const DAY_LENGTH_SECONDS = parseInt(process.env.DAY_LENGTH_SECONDS || "1800", 10);

export async function buildStatusEmbed(interaction) {
  const state = await getServiceState(SERVICE_NAME);
  const isOnline = state === "active";

  const embed = brand(new EmbedBuilder(), interaction)
    .setTitle("🛡️ Vikea — Valheim Server")
    .setTimestamp();

  if (!isOnline) {
    embed
      .setColor(0xed4245)
      .setDescription(`🔴 **Offline** (${state})`)
      .addFields({
        name: "Bring it back",
        value: "Use `/restart` to start it.",
      });
    return embed;
  }

  const startTime = await getServiceStartTime(SERVICE_NAME);
  const [liveState, lastSave] = await Promise.all([
    readLiveState(SERVICE_NAME, startTime),
    getLastSaveTime(),
  ]);

  const dayInfo = describeWorldDay(liveState.worldTime, DAY_LENGTH_SECONDS);
  const playersValue =
    liveState.playerCount === 0
      ? "No one online"
      : `${liveState.playerCount} online${
          liveState.onlineNames.length ? `: ${liveState.onlineNames.join(", ")}` : ""
        }`;

  const joinCodeBlock = liveState.joinCode
    ? `**Join Code**\n${ansiBlock(liveState.joinCode, ANSI.boldYellow)}`
    : "**Join Code**\n*(unknown)*";
  const dayLine = dayInfo
    ? `⏳ **Day ${dayInfo.day}** — ${dayInfo.percent}% through the day`
    : "⏳ **In-Game Day** — unknown";
  const uptimeValue = startTime ? `<t:${Math.floor(startTime.getTime() / 1000)}:R>` : "unknown";
  const lastSaveValue = lastSave ? `<t:${Math.floor(lastSave.getTime() / 1000)}:R>` : "unknown";

  embed
    .setColor(0x57f287)
    .setDescription(`🟢 **Online**\n\n${joinCodeBlock}\n${dayLine}`)
    .addFields(
      { name: "Uptime", value: uptimeValue, inline: true },
      { name: "Last Saved", value: lastSaveValue, inline: true },
      { name: "Players", value: playersValue, inline: false },
    );

  return embed;
}
