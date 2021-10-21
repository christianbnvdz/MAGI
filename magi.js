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
  if (!isCommandRequest(message)) return;

  const {command, argString} = splitRequestComponents(message);
  const commandModule = getCommandModule(command);

  if (!commandModule) {
    return;
  }

  if (!authorHasPermission(message, commandModule)) {
    return;
  }

  const tokenizedArgs = tokenizeArgs(argString);

  if (tokenizedArgs === null) {
    return;
  }

  commandModule.execute(message, tokenizedArgs);
});

client.commands = await client.commands;
client.login(process.env.TOKEN);

/**
 * Loads all commands in the commands directory and subdirectories into a
 * Collection.
 * @returns {Promise<Collection<string,Object>>} A Promise to a Collection
 * where the keys are the names of the commands and the Objects are the
 * imported modules.
 */
async function loadCommands() {
  const adminCommands = loadCommandType(CommandType.ADMIN);
  const chatCommands = loadCommandType(CommandType.CHAT);
  const miscCommands = loadCommandType(CommandType.MISC);

  const commands =
      await Promise.all([adminCommands, chatCommands, miscCommands]);
  return commands[0].concat(commands[1], commands[2]);
}

/**
 * Loads all commands of the specified command type directory into a
 * Collection. This also adds a new field to a copy of the imported command
 * module called TYPE. Which is assigned the value of commandType and then
 * placed into the Collection.
 * @param {CommandType} commandType - The type of commands to
 * load.
 * @returns {Promise<Collection<string,Object>>} A Promise to a Collection
 * where the keys are the names of the commands and the Objects are the
 * imported modules.
 */
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

/**
 * Indicates whether the command should be handled or ignored. This
 * function determines whether a message is just a message or a command.
 * If whitespace immediately follows the prefix then it is not considered a
 * command.
 * @param {Message} message - The message from the message event.
 * @returns {boolean}
 */
function isCommandRequest(message) {
  if (message.author.bot ||
      !message.content.startsWith(process.env.PREFIX) ||
      message.content.length == 1 ||
      message.content.match(new RegExp(`^${process.env.PREFIX}\s`)))
    return false;

  return true;
}

/**
 * Splits a message body into two strings at the first space.
 * If none then the command is returned along with "" as the arg string.
 * @param {Message} message
 * @returns {[string, string]}
 */
function splitRequestComponents(message) {
  const command = message.content;
  const spaceIndex = command.indexOf(' ');

  if (spaceIndex === -1) return [command, ""];

  return [command.slice(0, spaceIndex), command.slice(spaceIndex + 1)];
}

/**
 * Returns true if the user is allowed to use the command. If not, a message
 * will be sent to the channel to let the user know they aren't allowed.
 * @param {Message} message - The Message that was sent by the user.
 * @param {Object} commandModule - The imported command module object.
 * @returns {boolean}
 */
function hasPermission(message, commandModule) {
  if (commandModule.TYPE === CommandType.ADMIN &&
      message.author.id !== message.guild.ownerId) {
    message.channel.send(
        '>>> You must be the server owner to use this command.');
    return false;
  }

  return true;
}
