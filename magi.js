import process from 'process';
import {Client, Collection, Intents} from 'discord.js';
import {config} from 'dotenv';
import {readdirSync} from 'fs';

const INTENTS = [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES];

// setup enviornment variables from .env
config();

const client = new Client({intents: INTENTS});

client.commands = new Collection();
const commandFiles =
    readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const commandModule = await import(`./commands/${file}`);
  client.commands.set(commandModule.NAME, commandModule);
}

client.on('messageCreate', message => {
  if (!message.content.startsWith(process.env.PREFIX) || message.author.bot)
    return;

  const args = message.content.toLowerCase()
                   .slice(process.env.PREFIX.length)
                   .trim()
                   .split(/\s+/);
  const command = args.shift();

  if (!client.commands.has(command)) return;

  const commandModule = client.commands.get(command);

  for (const arg of args) {
    if (!commandModule.RECOGNIZED_ARGS.includes(arg)) {
      message.channel.send(
          `Unrecognized argument: ${arg}\n${commandModule.USAGE}`);
      return;
    }
  }

  commandModule.execute(message, args);
});

client.login(process.env.TOKEN);
