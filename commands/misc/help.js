/**
 * @module commands/misc/help
 */
import process from 'process';
import {MessageEmbed} from 'discord.js';
import {CommandType} from './../../utils/command.js';

const NAME = 'help';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} [command]`;
const DESCRIPTION = 'Lists all commands. Prints the usage and description for a command if present.';
/**
 * Posts a help message for the specified command. If no command was given,
 * a list of commands is sent out as a message embed with commands separated
 * by category.
 * @param {Message} message - The Message that triggered this command.
 * @param {string[]} args - The arguments passed to the command.
 */
function execute(message, args) {
  if (!isValidCommand(args, message.channel)) return;

  if (args.length === 1) {
    const command = message.client.commands.get(args[0]);
    message.channel.send(`>>> ${command.USAGE}\n${command.DESCRIPTION}`);
  } else {
    sendCommandList(message);
  }
}

export {NAME, USAGE, DESCRIPTION, isValidCommand, execute};

/**
 * Sends a message embed with a list of commands organized into categories.
 * @param {Message} message
 */
async function sendCommandList(message) {
  const adminCommands = getCommands(message.client.commands, CommandType.ADMIN);
  // More learning to be done before chatbot can be started
  const chatCommands = getCommands(message.client.commands, CommandType.CHAT);
  const miscCommands = getCommands(message.client.commands, CommandType.MISC);

  const guild = await message.client.guilds.fetch(message.guildId);
  const guildClient = guild.me;
  const clientIcon = guildClient.user.displayAvatarURL({dynamic: true});
  const commandsEmbed = new MessageEmbed()
      .setColor('#385028')
      .setAuthor(guildClient.displayName, clientIcon)
      .setTitle(`${guildClient.displayName}'s Commands`)
      .setThumbnail(clientIcon)
      .setDescription(`Use ${process.env.PREFIX}${NAME} <command> for more.`)
      .addFields(
          {name: 'Administrative', value: adminCommands, inline: true},
          {name: 'TBD', value: chatCommands, inline: true},
          {name: 'Miscellaneous', value: miscCommands, inline: true}
      );

  message.channel.send({embeds: [commandsEmbed]});
}

/**
 * Generates a string where each command name for a command type is on it's
 * own line with the prefix. If there are no commands of that type then '-'
 * is returned.
 * @param {Collection<string, Object>} commands
 * @param {CommandType} type
 * @return {string}
 */
function getCommands(commands, type) {
  let commandString = '';

  for (const [name, command] of commands)
    if (command.TYPE === type)
      commandString += `${process.env.PREFIX}${name}\n`;

  if (commandString === '') return '-';

  return commandString;
}

/**
 * Checks to see if the command structure is valid without processing the
 * arguments.
 * @param {string[]} args
 * @param {TextChannel} channel
 * @return {boolean}
 */
function isValidCommand(args, channel) {
  if (args.length > 1) {
    channel.send(`>>> Too many arguments passed.\n${USAGE}`);
    return false;
  } else if (args.length === 1 && !channel.client.commands.has(args[0])) {
    channel.send(`>>> ${args[0]} is not a recognized command.\n${USAGE}`);
    return false;
  }

  return true;
}
