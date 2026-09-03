// Shared visual branding for every embed the bot sends: a consistent footer.
export function brand(embed, client) {
  return embed.setFooter({
    text: "Vikea Server Monitor",
    iconURL: client.user.displayAvatarURL(),
  });
}

// ANSI color codes only render inside ```ansi code blocks in Discord clients.
const ESC = String.fromCharCode(27);
export const ANSI = {
  reset: `${ESC}[0m`,
  boldYellow: `${ESC}[1;33m`,
  boldRed: `${ESC}[1;31m`,
  boldGreen: `${ESC}[1;32m`,
  boldGray: `${ESC}[1;30m`,
};

export function ansiBlock(text, color) {
  return `\`\`\`ansi\n${color}${text}${ANSI.reset}\n\`\`\``;
}
