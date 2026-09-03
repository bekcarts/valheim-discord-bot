import "dotenv/config";
import { REST, Routes } from "discord.js";
import * as status from "./commands/status.js";
import * as restart from "./commands/restart.js";
import * as info from "./commands/info.js";

const commands = [status.data.toJSON(), restart.data.toJSON(), info.data.toJSON()];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

const route = process.env.GUILD_ID
  ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
  : Routes.applicationCommands(process.env.CLIENT_ID);

const result = await rest.put(route, { body: commands });
console.log(`Registered ${result.length} slash command(s).`);
