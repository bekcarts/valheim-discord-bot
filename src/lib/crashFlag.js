import { access, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A systemd OnFailure= hook on valheim-vikea.service touches this file the
// instant the game process fails, so we don't have to poll systemctl and
// risk missing the brief "failed" state before it auto-restarts.
export const CRASH_FLAG_PATH = path.join(__dirname, "..", "..", "data", "crash-flag");

export async function checkAndClearCrashFlag() {
  try {
    await access(CRASH_FLAG_PATH);
  } catch {
    return false;
  }
  await unlink(CRASH_FLAG_PATH).catch(() => {});
  return true;
}
