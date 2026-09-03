import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";

const execFileAsync = promisify(execFile);

const PLUGINS_DIR =
  "/home/ubentu/snap/steam/common/.local/share/Steam/steamapps/common/Valheim dedicated server/BepInEx/plugins";

/** Reads the running server's actual launch flags from /proc, so this never drifts from reality. */
export async function getLaunchArgs(serviceName) {
  const { stdout } = await execFileAsync("systemctl", [
    "show",
    serviceName,
    "-p",
    "MainPID",
    "--value",
  ]);
  const pid = stdout.trim();
  if (!pid || pid === "0") return null;

  let raw;
  try {
    raw = await readFile(`/proc/${pid}/cmdline`, "utf8");
  } catch {
    return null;
  }

  const parts = raw.split("\0").filter(Boolean);
  const args = { crossplay: false, hasPassword: false, modifiers: [] };
  for (let i = 0; i < parts.length; i++) {
    switch (parts[i]) {
      case "-name":
        args.name = parts[++i];
        break;
      case "-port":
        args.port = parts[++i];
        break;
      case "-world":
        args.world = parts[++i];
        break;
      case "-password":
        args.hasPassword = true;
        i++;
        break;
      case "-crossplay":
        args.crossplay = true;
        break;
      case "-modifier":
        args.modifiers.push(`${parts[i + 1]} ${parts[i + 2]}`);
        i += 2;
        break;
    }
  }
  return args;
}

export async function getVersionInfo(serviceName, sinceDate) {
  const journalArgs = ["-u", serviceName, "--no-pager", "-o", "cat"];
  if (sinceDate) journalArgs.push("--since", sinceDate.toISOString());
  const { stdout } = await execFileAsync("journalctl", journalArgs);

  // Use the last match in case the window ever includes more than one boot.
  const versionMatches = [...stdout.matchAll(/Valheim l-([\d.]+) \(network version (\d+)\)/g)];
  const moddedMatches = [...stdout.matchAll(/isModded: (True|False)/g)];
  const lastVersion = versionMatches.at(-1);
  const lastModded = moddedMatches.at(-1);
  return {
    version: lastVersion ? lastVersion[1] : null,
    networkVersion: lastVersion ? lastVersion[2] : null,
    modded: lastModded ? lastModded[1] === "True" : null,
  };
}

export async function getModList() {
  try {
    const files = await readdir(PLUGINS_DIR);
    return files.filter((f) => f.endsWith(".dll")).map((f) => f.replace(/\.dll$/, ""));
  } catch {
    return [];
  }
}
