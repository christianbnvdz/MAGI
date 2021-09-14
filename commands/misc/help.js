import process from 'process';
import {MessageEmbed} from 'discord.js';

const NAME = 'help';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} [command]`;
const DESCRIPTION = 'Lists all commands. Prints the usage and description for a command if present.';
const TYPE = 'MISC';
function execute(message, args) {
  if (args.length === 1) {
    const command = message.client.commands.get(args[0]);
    message.channel.send(`>>> ${command.USAGE}\n${command.DESCRIPTION}`);
  } else {
    sendCommandList(message);
  }
}

export {NAME, USAGE, DESCRIPTION, TYPE, isValidCommand, execute};

// Takes a message
// Sends a message embed with the list off all commands
async function sendCommandList (message) {
  const adminCommands = getCommands(message.client.commands, 'ADMIN');
  // More learning to be done before chatbot can be started
  const chatCommands = getCommands(message.client.commands, 'CHAT');
  const miscCommands = getCommands(message.client.commands, 'MISC');

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

// Takes a <Collection> (command name, command module) and a command type
// Returns a string of command type commands in the format that we want to
// display in the message embed.
// Note, an empty string will result in an error when passed to the value field
// of the object in the addFields method above. This is why there is a default
// return value of '-'.
function getCommands(commands, type) {
  let commandString = '';

  for (const [name, command] of commands)
    if (command.TYPE === type)
      commandString += `${process.env.PREFIX}${name}\n`;

  if (commandString === '') return '-';

  return commandString;
}

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
