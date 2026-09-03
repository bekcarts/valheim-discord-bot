import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat } from "node:fs/promises";

const execFileAsync = promisify(execFile);

const PLAYER_COUNT_RE = /(?:now|with) (\d+) player\(s\)/;
const JOIN_CODE_RE = /join code (\d+)/;
const HANDSHAKE_RE = /Got handshake from client/;
const CHARACTER_NAME_RE = /Got character ZDOID from (.+?) :/;
const CONNECTION_LOST_RE = /Player connection lost/;
const WORLD_TIME_RE = /World time: ([\d.]+)/;

const WORLD_SAVE_PATH =
  "/home/ubentu/.config/unity3d/IronGate/Valheim/worlds_local/Vikea_1.db";

/**
 * Reads the journal since the service's current run started and reconstructs
 * best-effort live state: player count (authoritative), online player names
 * (best-effort FIFO correlation, since the log doesn't link names to connect/
 * disconnect events by ID), current join code, and raw world-time seconds.
 */
export async function readLiveState(serviceName, sinceDate) {
  const args = ["-u", serviceName, "--no-pager", "-o", "cat"];
  if (sinceDate) {
    args.push("--since", sinceDate.toISOString());
  }
  const { stdout } = await execFileAsync("journalctl", args);
  const lines = stdout.split("\n");

  let playerCount = 0;
  let joinCode = null;
  let worldTime = null;
  const pendingConnections = []; // slots waiting for a name
  const onlineNames = [];

  for (const line of lines) {
    const countMatch = line.match(PLAYER_COUNT_RE);
    if (countMatch) playerCount = parseInt(countMatch[1], 10);

    const joinCodeMatch = line.match(JOIN_CODE_RE);
    if (joinCodeMatch) joinCode = joinCodeMatch[1];

    const worldTimeMatch = line.match(WORLD_TIME_RE);
    if (worldTimeMatch) worldTime = parseFloat(worldTimeMatch[1]);

    if (HANDSHAKE_RE.test(line)) {
      pendingConnections.push(true);
    }

    const nameMatch = line.match(CHARACTER_NAME_RE);
    if (nameMatch) {
      const name = nameMatch[1];
      if (!onlineNames.includes(name)) {
        onlineNames.push(name);
      }
      if (pendingConnections.length > 0) pendingConnections.shift();
    }

    if (CONNECTION_LOST_RE.test(line) && onlineNames.length > 0) {
      onlineNames.shift();
    }
  }

  // The numeric count from "now N player(s)" is authoritative; reconcile the
  // best-effort name list to it so we never claim more names than players.
  while (onlineNames.length > playerCount) onlineNames.shift();

  return { playerCount, onlineNames, joinCode, worldTime };
}

export async function getLastSaveTime() {
  try {
    const info = await stat(WORLD_SAVE_PATH);
    return info.mtime;
  } catch {
    return null;
  }
}

export function describeWorldDay(worldTime, dayLengthSeconds) {
  if (worldTime == null) return null;
  const day = Math.floor(worldTime / dayLengthSeconds) + 1;
  const progress = (worldTime % dayLengthSeconds) / dayLengthSeconds;
  const percent = Math.round(progress * 100);
  return { day, percent };
}
