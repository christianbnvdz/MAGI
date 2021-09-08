import process from 'process';

const NAME = 'nickname';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} <userId | user mention> [nickname]`;
const DESCRIPTION = 'Changes the nickname of a user. Removes the current nickname from a user if none is provided.';
const TYPE = 'ADMIN';
async function execute(message, args) {
  let member;

  if (args[0].startsWith('<@')) {
    member = message.mentions.members.first();
  } else if (!isNaN(args[0])) {
    try {
      member = await message.guild.members.fetch(args[0]);
    } catch (e) {
      message.channel.send('>>> Invalid userId.');
      return;
    }
  } else {
    message.channel.send(`>>> ${args[0]} is not a userId or user mention.`);
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

  try {
    await member.setNickname(nickname);
  } catch (e) {
    message.channel.send(
        '>>> Cannot change the nickname of a user with a higher role');
    return;
  }
}

export {NAME, USAGE, DESCRIPTION, TYPE, isValidCommand, execute};

function isValidCommand(args, channel) {
  if (!args.length) {
    channel.send(`>>> No user specified.\n${USAGE}`);
    return false;
  }

  return true;
}
