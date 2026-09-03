# Vikea Valheim Discord Bot

`/status` — online state, players online, join code, in-game day, uptime, last save.
`/restart` — role-gated, cooldown-limited, warns for a few minutes before restarting
(both in Discord and as an in-game broadcast).
`/info` — world/port/crossplay/mods/version config, read live from the running process.
`/announce` — anyone can broadcast a message to everyone in-game (cooldown-limited).
Crash alerts — pings a role in the channel automatically if the game process fails.

## 1. Discord application

Create an application + bot at https://discord.com/developers/applications, then:
- Copy the **bot token** → `DISCORD_TOKEN`
- Copy the **application (client) ID** → `CLIENT_ID`
- Under OAuth2 URL Generator, check `bot` + `applications.commands`, permission
  `Send Messages`, and use the generated URL to invite it to your server.
- Right-click your server icon → Copy Server ID (enable Developer Mode first) → `GUILD_ID`
- Right-click the role that should be allowed to restart the server → Copy Role ID → `ALLOWED_ROLE_IDS`
  (comma-separate multiple roles; leave blank to let anyone use `/restart`)
- Right-click the channel the bot should respond in → Copy Channel ID → `ALLOWED_CHANNEL_ID`
  (leave blank to allow any channel)
- Right-click the role that should be pinged on a crash → Copy Role ID → `CRASH_ALERT_ROLE_ID`
  (leave blank for a plain, unpinged alert)

Copy `.env.example` to `.env` and fill in the values above.

## 2. Install & register commands

```bash
cd /home/ubentu/personal/valheim-discord-bot
npm install
npm run register-commands
```

## 3. Sudo rule for restarting the game service

The bot restarts the game with `sudo systemctl restart valheim-vikea.service`. This
needs a narrowly-scoped passwordless sudo rule — it should NOT have broad sudo access.
Add it yourself with:

```bash
sudo visudo -f /etc/sudoers.d/valheim-discord-bot
```

and put exactly this in the file:

```
ubentu ALL=(root) NOPASSWD: /usr/bin/systemctl restart valheim-vikea.service
```

(`/status` needs no special permissions — reading `journalctl`/`systemctl` for this
unit already works for `ubentu` via the `adm` group.)

## 4. Crash alerting

If the game process crashes, `systemd`'s `OnFailure=` hook (not polling, so it can't
miss the brief failed state before `Restart=on-failure` kicks in) touches a flag file
that the bot checks every 15s and turns into a Discord alert.

Install the one-shot flag-writer:

```bash
sudo cp /home/ubentu/personal/valheim-discord-bot/systemd/valheim-crash-flag.service /etc/systemd/system/
```

Wire it to the game service without touching its original unit file:

```bash
sudo mkdir -p /etc/systemd/system/valheim-vikea.service.d
sudo cp /home/ubentu/personal/valheim-discord-bot/systemd/valheim-vikea-onfailure.conf \
  /etc/systemd/system/valheim-vikea.service.d/override.conf
sudo systemctl daemon-reload
```

No `enable` needed for `valheim-crash-flag.service` — `OnFailure=` starts it on demand.

## 5. In-game broadcasts (RCON)

`/announce` and `/restart`'s countdown push real messages into the game (center-screen
text), not just Discord. This needs three BepInEx mods installed on the **game server**
(not this bot's directory) and RCON configured:

- [`AviiNL/rcon`](https://github.com/AviiNL/BepInEx.rcon) — adds an RCON port to the server.
- [`JereKuusela/Rcon_Commands`](https://github.com/JereKuusela/valheim-rcon_commands) — lets RCON execute console commands.
- [`JereKuusela/Server_devcommands`](https://github.com/JereKuusela/valheim-dev) — provides the `broadcast` command itself.

Drop each mod's DLL into `BepInEx/plugins/` on the game server, start it once to
generate configs, then stop it and edit:

- `BepInEx/config/nl.avii.plugins.rcon.cfg` — set `enabled = true` and pick a strong `password`.
- `BepInEx/config/server_devcommands.cfg` — set `Server chat = true` (lets the server itself
  send broadcasts without a live admin client connected).

Then set in this bot's `.env`: `RCON_HOST` (usually `127.0.0.1`, since the bot and game
run on the same box), `RCON_PORT` (matches the rcon config, default `2458`), and
`RCON_PASSWORD` (matches the rcon config).

**Never port-forward the RCON port** — unlike the game port or WebMap, it grants full
admin command execution on the server.

## 6. Run it

For a one-off test run:

```bash
npm start
```

To run it permanently as a service, copy `valheim-discord-bot.service` into
`/etc/systemd/system/`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now valheim-discord-bot.service
```

## Notes

- Player names shown by `/status` are best-effort — the game log doesn't tag
  connect/disconnect events with a player ID, so names are matched in
  connection order. The player *count* is always accurate.
- In-game day/time assumes the default 1800s day length; change
  `DAY_LENGTH_SECONDS` in `.env` if the server's day length is modified.
- In-game broadcasts (`/announce`, restart countdown) are best-effort — if RCON is
  unreachable or unconfigured, the Discord-side flow still completes normally,
  it just won't show up in-game.
