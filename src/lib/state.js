import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(__dirname, "..", "..", "data", "state.json");

async function readState() {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeState(state) {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
}

export async function getLastRestartRequestAt() {
  const state = await readState();
  return state.lastRestartRequestAt ? new Date(state.lastRestartRequestAt) : null;
}

export async function setLastRestartRequestAt(date) {
  const state = await readState();
  state.lastRestartRequestAt = date.toISOString();
  await writeState(state);
}

// In-memory only: whether a countdown is actively running right now. Doesn't
// need to survive a bot restart, since a countdown in progress implies the
// bot process is up and running it.
let restartInProgress = false;

export function isRestartInProgress() {
  return restartInProgress;
}

export function setRestartInProgress(value) {
  restartInProgress = value;
}
