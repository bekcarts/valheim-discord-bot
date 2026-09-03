import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** @returns {Promise<"active"|"inactive"|"failed"|"activating"|"deactivating"|"unknown">} */
export async function getServiceState(serviceName) {
  try {
    const { stdout } = await execFileAsync("systemctl", ["is-active", serviceName]);
    return stdout.trim();
  } catch (err) {
    // systemctl exits non-zero for inactive/failed but still prints the state to stdout
    const state = err.stdout?.trim();
    return state || "unknown";
  }
}

/** @returns {Promise<Date|null>} when the current run of the service started */
export async function getServiceStartTime(serviceName) {
  const { stdout } = await execFileAsync("systemctl", [
    "show",
    serviceName,
    "-p",
    "ActiveEnterTimestamp",
    "--value",
  ]);
  const raw = stdout.trim();
  if (!raw || raw === "n/a") return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Restarts the service. Requires the scoped sudoers NOPASSWD rule described in the README. */
export async function restartService(serviceName) {
  await execFileAsync("sudo", ["-n", "systemctl", "restart", serviceName]);
}
