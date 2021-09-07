import process from 'process';

const NAME = 'set-server-name';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} <new server name>`;
const DESCRIPTION = 'Changes the server name.';
const TYPE = 'ADMIN';
function execute(message, args) {
  const messageText = message.content;
  const serverName = messageText
      .substring(NAME.length + 1, messageText.length)
      .trim();

  if (serverName.includes('\n')) {
    message.channel.send('>>> Server names cannot contain a newline.');
    return;
  }

  if (serverName.length > 100 || serverName.length < 2) {
    message.channel.send('>>> Server names must be 2-100 characters long.');
    return;
  }

  message.guild.setName(serverName);
}

export {NAME, USAGE, DESCRIPTION, TYPE, isValidCommand, execute};

function isValidCommand(args, channel) {
  if (args.length === 0) {
    channel.send(`>>> You must provide a server name.\n${USAGE}`);
    return false;
  }

  return true;
}
