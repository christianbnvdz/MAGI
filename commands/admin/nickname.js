/**
 * @module commands/admin/nickname
 */
import process from 'process';
import {MessageEmbed} from 'discord.js';

const NAME = 'nickname';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} <userId | user mention> [nickname]`;
const DESCRIPTION = 'Changes the nickname of a user. Removes the current nickname from a user if none is provided.';
/**
 * Nicknames the specified user or removes a nickname if none is given.
 * @param {Message} message
 * @param {string[]} args
 */
async function execute(message, args) {
  if (!isValidCommand(args, message.channel)) return;

  let member;

  try {
    member = await getGuildMember(message, args);
    if (!member) {
      message.channel.send(`>>> ${args[0]} is not a userId or user mention.`);
      return;
    }
  } catch (e) {
    message.channel.send('>>> Invalid userId.');
    return;
  }

  if (args.length === 1 && member.displayName === member.user.username) {
    message.channel.send('>>> User does not have a nickname to remove.');
    return;
  }

  const oldNickname = member.displayName;
  console.log(oldNickname);
  const nickname = (args.length === 2) ? args[1].trim() : '';
  console.log(nickname);

  if (nickname === oldNickname) {
    message.channel.send('>>> Nickname is the same as before.');
    return;
  } else if (nickname.length > 32) {
    message.channel.send('>>> Nickname must be 32 characters or less.');
    return;
  }

  try {
    await member.setNickname(nickname);
  } catch (e) {
    message.channel.send(
        '>>> Cannot change the nickname of a user with a higher role than me.');
    return;
  }

  message.channel.send(
      {embeds: [generateSuccessEmbed(message, member, oldNickname, nickname)]});
}

export {NAME, USAGE, DESCRIPTION, execute};

/**
 * Creates and returns a MessageEmbed as a response to successful nicknaming.
 * @param {Message} message
 * @param {GuildMember} member
 * @param {string} oldNickname
 * @param {string} newNickname
 * @return {MessageEmbed}
 */
function generateSuccessEmbed(message, member, oldNickname, newNickname) {
  // Prepare nickname strings to show up correctly in the embed
  oldNickname = oldNickname.replaceAll(/\\/g, '\\\\');
  newNickname = newNickname.replaceAll(/\\/g, '\\\\');
  console.log(oldNickname, newNickname);
  const author = message.guild.members.cache.get(message.author.id);
  const updateType = (newNickname.length) ? 'Updated' : 'Removed';
  const descriptionTail = (newNickname.length) ?
      ` from **${oldNickname}** to **${newNickname}**` :
      `, **${oldNickname}**`;
  return new MessageEmbed()
      .setAuthor(
          author.displayName, author.user.displayAvatarURL({dynamic: true}))
      .setColor('#385028')
      .setThumbnail(member.user.displayAvatarURL({dynamic: true}))
      .setTitle('Nickname ' + updateType)
      .setDescription(
          `**${author.displayName}** ${updateType.toLowerCase()} **${member.user.username}**'s nickname${descriptionTail}.`);
}

/**
 * Gets a GuildMember of the mentioned user or by ID. If the user can't be
 * found then this returns null. This will throw an invalid user error
 * if the userId isn't valid.
 * @param {Message} message
 * @param {string[]} args
 * @return {GuildMember|null}
 */
async function getGuildMember(message, args) {
  let guildMember = null;

  if (args[0].startsWith('<@')) {
    guildMember = message.mentions.members.first();
  } else if (!isNaN(args[0])) {
    guildMember = await message.guild.members.fetch(
                      {user: args[0], force: true});
  }

  return guildMember;
}

/**
 * Checks to see if the command structure is valid without processing the
 * arguments.
 * @param {string[]} args
 * @param {TextChannel} channel
 * @return {boolean}
 */
function isValidCommand(args, channel) {
  if (!args.length) {
    channel.send(`>>> No user specified.\n${USAGE}`);
    return false;
  } else if (args.length > 2) {
    channel.send(`>>> Too many arguments supplied.\n${USAGE}`);
    return false;
  }

  return true;
}
