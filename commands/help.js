import process from 'process';
import {MessageEmbed} from 'discord.js';

const NAME = 'help';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} [command]`;
const DESCRIPTION = 'Lists all commands. Prints the usage and description for a command if present.';function execute(message, args) {
  if (args.length === 1) {
    const command = message.client.commands.get(args[0]);
    message.channel.send(`${command.USAGE}\n${command.DESCRIPTION}`);
  } else {
    sendCommandList(message);
  }
}

async function sendCommandList (message) {
  // These are currently hard coded, fix this later
  const adminCommands = '!archive';
  // More learning to be done before chatbot can be started
  const unknownCategory = '?\n?\n?\n...';
  const miscCommands = '!pfp\n!help';

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
          {name: 'TBD', value: unknownCategory, inline: true},
          {name: 'Miscellaneous', value: miscCommands, inline: true}
      );

  message.channel.send({embeds: [commandsEmbed]});
}

export {NAME, USAGE, DESCRIPTION, isValidCommand, execute};

function isValidCommand(args, channel) {
  if (args.length > 1) {
    channel.send(`Too many arguments passed.\n${USAGE}`);
    return false;
  } else if (args.length === 1 && !channel.client.commands.has(args[0])) {
    channel.send(`${args[0]} is not a recognized command.\n${USAGE}`);
    return false;
  }

  return true;
}
