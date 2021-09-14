import process from 'process';
import {MessageEmbed} from 'discord.js';

const NAME = 'set-server-name';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} <new server name>`;
const DESCRIPTION = 'Changes the server name.';
async function execute(message, args) {
  const messageText = message.content;
  const serverName = messageText
      .substring(
          NAME.length + process.env.PREFIX.length + 1, messageText.length)
      .trim();

  if (serverName === message.guild.name) {
    message.channel.send('>>> Server name is unchanged.');
    return;
  } else if (serverName.includes('\n')) {
    message.channel.send('>>> Server names cannot contain a newline.');
    return;
  } else if (serverName.length > 100 || serverName.length < 2) {
    message.channel.send('>>> Server names must be 2-100 characters long.');
    return;
  }

  const successEmbed = generateSuccessEmbed(message, serverName);
  await message.guild.setName(serverName);

  message.channel.send({embeds: [successEmbed]});
}

export {NAME, USAGE, DESCRIPTION, isValidCommand, execute};

// Takes a Message and a server name
// Generates an embed to send on succesful server name change
// Note that when you call setName on a guild, the message gets changed
// as well. So this function must be called before the call to setName
function generateSuccessEmbed(message, newServerName) {
  const oldServerName = message.guild.name;
  const guildMember = message.guild.members.cache.get(message.author.id);
  return new MessageEmbed()
      .setAuthor(
          guildMember.displayName,
          guildMember.user.displayAvatarURL({dynamic: true}))
      .setColor('#385028')
      .setThumbnail(message.guild.iconURL({dynamic: true}))
      .setTitle('Server Name Changed')
      .setDescription(
          `**${guildMember.displayName}** changed the server name from **${oldServerName}** to **${newServerName}**.`);
}

function isValidCommand(args, channel) {
  if (args.length === 0) {
    channel.send(`>>> You must provide a server name.\n${USAGE}`);
    return false;
  }

  return true;
}
