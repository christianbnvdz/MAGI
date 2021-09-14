import {Client, Collection, Intents} from 'discord.js';
import {config} from 'dotenv';
import {readdir} from 'fs/promises';
import process from 'process';
import {CommandType} from './utils/command.js';

const INTENTS = [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES];

// setup enviornment variables from .env
config();

const client = new Client({intents: INTENTS});
client.commands = loadCommands();

client.on('messageCreate', message => {
  if (!message.content.startsWith(process.env.PREFIX) || message.author.bot)
    return;

  const args = message.content.toLowerCase()
                   .slice(process.env.PREFIX.length)
                   .trim()
                   .split(/\s+/);
  const command = args.shift();

  if (!client.commands.has(command)) return;

  const commandModule = client.commands.get(command);

  if (!hasPermission(message, commandModule)) return;

  if (!commandModule.isValidCommand(args, message.channel)) return;

  commandModule.execute(message, args);
});

client.commands = await client.commands;
client.login(process.env.TOKEN);

// Returns a collection promise containing all commands in the commands
// subdirectories admin, chat, and misc
async function loadCommands() {
  const adminCommands = loadCommandType(CommandType.ADMIN);
  const chatCommands = loadCommandType(CommandType.CHAT);
  const miscCommands = loadCommandType(CommandType.MISC);

  const commands =
      await Promise.all([adminCommands, chatCommands, miscCommands]);
  return commands[0].concat(commands[1], commands[2]);
}

// Returns a collection promise containing all commands in a command
// subdirectory: admin, chat, or misc.
// Note: This function also adds a new field to the imported command module
// called TYPE which assigns the type based on what directory it is in
async function loadCommandType(commandType) {
  const commands = new Collection();
  const commandFiles = (await readdir(`./commands/${commandType}`))
      .filter(file => file.endsWith('js'));

  const commandImports = [];

  for (const file of commandFiles) {
    commandImports.push(import(`./commands/${commandType}/${file}`));
  }

  const commandModules = await Promise.all(commandImports);

  for (const commandModule of commandModules) {
    const modifiedModule = {...commandModule, TYPE: commandType};
    commands.set(modifiedModule.NAME, modifiedModule);
  }

  return commands;
}

// Takes a Message and a commandModule
// Returns true or false depending on whether the author has permission to
// execute the command and sends a message to the channel if they dont
function hasPermission(message, commandModule) {
  if (commandModule.TYPE === CommandType.ADMIN &&
      message.author.id !== message.guild.ownerId) {
    message.channel.send('You must be the server owner to use this command.');
    return false;
  }

  return true;
}
