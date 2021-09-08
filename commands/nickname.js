import process from 'process';
import {MessageEmbed} from 'discord.js';

const NAME = 'nickname';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} <userId | user mention> [nickname]`;
const DESCRIPTION = 'Changes the nickname of a user. Removes the current nickname from a user if none is provided.';
const TYPE = 'ADMIN';
async function execute(message, args) {
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

  // Length of the prefix + length of the command name + the space + length of
  // userId or mention + 1 for space + 1 for first character in nickname
  // but - 1 to turn length into index.
  const nickname = message.content.substring(
      process.env.PREFIX.length + NAME.length + 1 + args[0].length + 1,
      message.content.length).trim();

  if (nickname.length > 32) {
    message.channel.send('>>> Nickname must be 32 characters or less.');
    return;
  }

  const oldNickname = member.displayName;

  try {
    await member.setNickname(nickname);
  } catch (e) {
    message.channel.send(
        '>>> Cannot change the nickname of a user with a higher role than me.');
    return;
  }

  const author = message.guild.members.cache.get(message.author.id);
  const updateType = (nickname.length) ? 'Updated' : 'Removed';
  const newNickname = (nickname.length) ? `from **${oldNickname}** to **${nickname}**` : `**${oldNickname}**`;
  const successEmbed = new MessageEmbed()
      .setAuthor(author.displayName,
                 author.user.displayAvatarURL({dynamic: true}))
      .setColor('#385028')
      .setThumbnail(member.user.displayAvatarURL({dynamic: true}))
      .setTitle('Nickname ' + updateType)
      .setDescription(
          `**${author.displayName}** ${updateType.toLowerCase()} **${member.user.username}**'s nickname ${newNickname}`);

  message.channel.send({embeds: [successEmbed]});
}

export {NAME, USAGE, DESCRIPTION, TYPE, isValidCommand, execute};

// Takes a message and arg array
// Returns a GuildMember or null if a valid userId or mention wasn't given
// This throws an invalid user error if the userId isn't valid
async function getGuildMember(message, args) {
  let guildMember = null;

  if (args[0].startsWith('<@')) {
    guildMember = message.mentions.members.first();
  } else if (!isNaN(args[0])) {
    guildMember = await message.guild.members.fetch(args[0]);
  }
  
  return guildMember;
}

function isValidCommand(args, channel) {
  if (!args.length) {
    channel.send(`>>> No user specified.\n${USAGE}`);
    return false;
  }

  return true;
}
