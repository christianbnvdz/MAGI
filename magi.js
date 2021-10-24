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

  const [command, argString] = splitRequestComponents(message);
  const commandModule = getCommandModule(command);

  if (!commandModule) {
    message.channel.send(`>>> Unrecognized command.`);
    return;
  }

  if (!authorHasPermission(message, commandModule)) {
    message.channel.send(`>>> You don't have permission to use this command.`);
    return;
  }

  const tokenizedArgs = tokenizeArgs(argString);

  if (!tokenizedArgs) {
    message.channel.send(`>>> Malformed arguments.`);
    return;
  }

  //commandModule.execute(message, tokenizedArgs);
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
      message.content.match(new RegExp(`^${process.env.PREFIX}\\s`)))
    return false;

  return true;
}

/**
 * Splits a message body into two strings at the first space.
 * If none then the command is returned along with "" as the arg string.
 * Intended for use after isCommandRequest().
 * @param {Message} message
 * @returns {[string, string]}
 */
function splitRequestComponents(message) {
  const command = message.content;
  const spaceIndex = command.indexOf(' ');

  if (spaceIndex === -1) return [command.slice(1), ''];

  return [command.slice(1, spaceIndex), command.slice(spaceIndex + 1).trim()];
}

/**
 * Gets the specified command module from the client. Returns null if
 * it is not found.
 * @param {String} command - the name of the command
 * @returns {Object | null}
 */
function getCommandModule(command) {
  return client.commands.has(command) ? client.commands.get(command) : null;
}

/**
 * Returns true if the user is allowed to use the command.
 * @param {Message} message - The Message that was sent by the user.
 * @param {Object} commandModule - The imported command module object.
 * @returns {boolean}
 */
function authorHasPermission(message, commandModule) {
  if (commandModule.TYPE === CommandType.ADMIN &&
      message.author.id !== message.guild.ownerId)
    return false;

  return true;
}

/**
 * Tokenize the arguments. Unescaped double quotes are used to preserve
 * whitespace. If double quotes contain only whitespace or nothing then its
 * not counted as an argument. Whitespace surrounding the argument within
 * double quotes is trimmed. Whitespace strings anywhere are treated as 1 space.
 * Tokenizing happens first, unescaped characters and certain
 * whitespace characters are omitted, and finally escaped characters are
 * replaced. Escape " with \" and \ with \\.
 * An error occurs if:
 *   1| the opening unescaped double quote is not preceeded by whitespace
 *   2| the closing unescaped double quote is not followed by whitespace
 *   3| there exists an unclosed unescaped double quote
 *   4| an escape is used with a non escapable character (not \" or \\)
 * If no arguments are passed then an empty array is
 * returned. If a tokenizing error occurs then null is returned.
 * @param {String} argString
 * @returns {String[] | null}
 */
function tokenizeArgs(argString) {
  argString = argString.trim();
  if (argString === '') return [];

  console.log(argString);

  let unclosedDoubleQuote = false;
  for (let i = 0; i < argString.length; ++i) {
    // Check to see if previous character is an escape and check for error 4
    if (i === 1) { // Possibility for an escape
      if (argString[i - 1] === '\\') {
        if (argString[i] !== '\\' && argString[i] !== '"') {
          console.log('Unrecognized escape character: i == 1');
          return null;
        }
        continue;
      }
    } else if (i > 1) { // Possibility for an escape or escaped backslash
      if (argString[i - 1] === '\\' && argString[i - 2] !== '\\') {
        if (argString[i] !== '\\' && argString[i] !== '"') {
          console.log('Unrecognized escape character: i > 1');
          return null;
        }
        continue;
      }
    }

    // By logic above, this is not escaped
    if (argString[i] === '"') {
      // Check for errors 1 and 2
      if (!unclosedDoubleQuote && i !== 0) { // Opening Double Quote
        console.log(('' + argString[i - 1]).match('\\s'));
        if (!(('' + argString[i - 1]).match('\\s'))) {
          console.log('Opening double quote is not preceeded by whitespace.');
          return null;
        }
      } else if (unclosedDoubleQuote && i !== argString.length - 1) { // Closing Double Quote
        console.log(('' + argString[i + 1]));
        console.log(argString[i + 1]);
        if (!(('' + argString[i + 1]).match('\\s'))) {
          console.log('Closing double quote is not followed by whitespace.');
          return null;
        }
      }

      unclosedDoubleQuote = !unclosedDoubleQuote;
    }

  }
  // Check for error 3
  if (unclosedDoubleQuote) {
    console.log('Uneven number of unescaped double quotes');
    return null;
  }

  return argString.split(' ');
}

// Tokens: 

// Trim and split by ' ' into an array
// In each element, check for errors #1-4
// Purge array of elements consisting of "" or " "
// Group / Expand array elements into one argument
// Replace escaped characters and drop double quotes from arguments
// Trim resulting arguments for surrounding whitespace
