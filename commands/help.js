import process from 'process';

const NAME = 'help';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} <command>`;
const DESCRIPTION = 'Prints the usage and description for a command.';
function execute(message, args) {
  const command = message.client.commands.get(args[0]);
  message.channel.send(`${command.USAGE}\n${command.DESCRIPTION}`);
}

export {NAME, USAGE, DESCRIPTION, isValidCommand, execute};

function isValidCommand(args, channel) {
  if (args.length !== 1) {
    channel.send(`Please provide exactly one command name.\n${USAGE}`);
    return false;
  }

  if (!channel.client.commands.has(args[0])) {
    channel.send(`${args[0]} is not a recognized command.\n${USAGE}`);
    return false;
  }

  return true;
}
