# Vikea Valheim Discord Bot

`/status` — online state, players online, join code, in-game day, uptime, last save.
`/restart` — role-gated, cooldown-limited, warns for a few minutes before restarting.

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

## 4. Run it

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
- There's no in-game chat broadcast for the restart countdown (no mod for it
  is installed) — the warning only appears in Discord.
