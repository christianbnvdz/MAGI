/**
 * @module commands/misc/pfp
 */
import process from 'process';

const NAME = 'pfp';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} <userId>`;
const DESCRIPTION = 'Posts the specified user\'s profile picture to the channel.';
/**
 * Posts the url of the specified user's profile picture.
 * @param {Message} message - The Message that triggered this command.
 * @param {string[]} args - The arguments passed to the command.
 */
async function execute(message, args) {
  if (!isValidCommand(args, message.channel)) return;

  try {
    const user = await message.client.users.fetch(args[0]);
    message.channel.send(user.displayAvatarURL({dynamic: true}));
  } catch (e) {
    if (e.code === 10013) {
      // Unkown User
      message.channel.send('>>> A user with that userId could not be found.');
    } else if (e.code === 50035) {
      // Invalid Form Body, not a snowflake
      message.channel.send('>>> userId given is not a snowflake.');
    }
  }
}

export {NAME, USAGE, DESCRIPTION, execute};

/**
 * Checks to see if the command structure is valid without processing the
 * arguments.
 * @param {string[]} args - The arguments passed to the command.
 * @param {TextChannel} channel - The TextChannel this command was used in.
 * @return {boolean}
 */
function isValidCommand(args, channel) {
  if (args.length !== 1) {
    channel.send(`>>> You must provide a userId and nothing else.\n${USAGE}`);
    return false;
  }

  if (isNaN(args[0])) {
    channel.send(`>>> Argument is not a userId.\n${USAGE}`);
    return false;
  }

  return true;
}
