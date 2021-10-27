/**
 * @module commands/admin/set_server_name
 */
import process from 'process';
import {MessageEmbed} from 'discord.js';

const NAME = 'set-server-name';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} <new server name>`;
const DESCRIPTION = 'Changes the server name.';
/**
 * Sets the server name to the supplied name.
 * @param {Message} message
 * @param {string[]} args
 */
async function execute(message, args) {
  if (!isValidCommand(args, message.channel)) return;

  const messageText = message.content;
  const serverName = args[0].trim();

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

export {NAME, USAGE, DESCRIPTION, execute};

/**
 * Generates a MessageEmbed that denotes successful name change.
 * This function must be called before the new name is set.
 * @param {Message} message
 * @param {string} newServerName
 */
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

/**
 * Checks to see if the command structure is valid without processing the
 * arguments.
 * @param {string[]} args
 * @param {TextChannel} channel
 * @return {boolean}
 */
function isValidCommand(args, channel) {
  if (args.length === 0) {
    channel.send(`>>> You must provide a server name.\n${USAGE}`);
    return false;
  } else if (args.length > 1) {
    channel.send(`>>> You must provide only one argument.\n${USAGE}`);
    return false;
  }

  return true;
}
