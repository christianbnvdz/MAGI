import {Client, Collection, Intents} from 'discord.js';
import {config} from 'dotenv';
import {readdirSync} from 'fs';

// setup enviornment variables from .env
config();

const intents = [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES];
const client = new Client({intents: intents});

client.commands = new Collection();
const commandFiles =
    readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const commandModule = await import(`./commands/${file}`);
  client.commands.set(commandModule.name, commandModule);
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
    if (!commandModule.recognizedArgs.includes(arg)) {
      message.channel.send('Unrecognized argument ' + arg);
      message.channel.send(commandModule.usage);
      return;
    }
  }

  commandModule.execute(message, args);
});

client.login(process.env.TOKEN);
