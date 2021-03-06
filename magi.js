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

  const [err, tokenizedArgs] = tokenizeArgs(argString);

  if (err) {
    message.channel.send(`>>> ${tokenizedArgs}.`);
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
 * not counted as an argument. Escaped characters are expanded as they are
 * encountered: \\ and \".
 * An error occurs if:
 *   1| the opening unescaped double quote is not preceeded by whitespace
 *   2| the closing unescaped double quote is not followed by whitespace
 *   3| there exists an unclosed unescaped double quote
 *   4| an escape is used with a non escapable character (not \" or \\)
 *   5| no character follows an escape at the end of argument string
 * If no arguments are passed then an empty array is
 * returned. If a tokenizing error occurs then the first element is set to
 * true, indicating an error occured. The second element is a string indicating
 * what error occured. If false then the first element is false and the second
 * element is the tokenized arguments.
 * @param {String} argString
 * @returns {[boolean, string[]] | [boolean, string]}
 */
function tokenizeArgs(argString) {
  argString = argString.trim();
  if (argString === '') return [false, []];

  const args = [];
  let tokenizedArg = '';
  let unclosedDoubleQuote = false;
  let inEscape = false;

  for (let i = 0; i < argString.length; ++i) {
    // Check for error 4
    if (!inEscape && argString[i] === '\\') {
      inEscape = true;
      // We dont add this to the token because we are expanding the following
      // escape character.
      continue;
    } else if (inEscape && (argString[i] === '\\' || argString[i] === '"')) {
      inEscape = false;
      tokenizedArg += argString[i];
      continue;
    } else if (inEscape) {
      return [true, `Unrecognized escape character: ${argString[i]}`];
    }

    // By logic above, this is not escaped
    if (argString[i] === '"') {
      // Check for errors 1 and 2
      if (!unclosedDoubleQuote) { // Opening Double Quote
        if (i !== 0 && !(('' + argString[i - 1]).match('\\s'))) {
          return [true, 'Opening double quote not preceeded by whitespace'];
        }

        if (tokenizedArg !== '') {
          args.push(tokenizedArg);
          tokenizedArg = '';
        }
      } else if (unclosedDoubleQuote) { // Closing Double Quote
        if (i !== argString.length - 1 &&
            !(('' + argString[i + 1]).match('\\s'))) {
          return [true, 'Closing double quote not followed by whitespace'];
        }

        if (!tokenizedArg.match('^\\s*$')) {
          args.push(tokenizedArg);
        }

        tokenizedArg = '';
      }

      unclosedDoubleQuote = !unclosedDoubleQuote;
    } else if (!unclosedDoubleQuote && ('' + argString[i]).match('\\s')) {
      if (tokenizedArg !== '') {
        args.push(tokenizedArg);
        tokenizedArg = '';
      }
    } else {
      tokenizedArg += argString[i];
    }
  }

  // Check for errors 3 and 5
  if (unclosedDoubleQuote) {
    return [true, 'Missing closing double quote'];
  } else if (inEscape) {
    return [true, 'No character following escape at end of arguments'];
  }

  // If the last argument is not surrounded by unescaped double quotes
  if (tokenizedArg !== '') {
    args.push(tokenizedArg);
    tokenizedArg === '';
  }

  return [false, args];
}
