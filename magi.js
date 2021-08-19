import {config} from 'dotenv';
config();

import {readdirSync} from 'fs';
import {Intents, Client, Collection} from 'discord.js';

const intents = [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES];
const client = new Client({intents: intents});

client.commands = new Collection();
const commandFiles = readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command_module = await import(`./commands/${file}`);
    client.commands.set(command_module.name, command_module);
}

client.on('messageCreate', message => {
    if (!message.content.startsWith(process.env.PREFIX) || message.author.bot) return;

    let args = message.content.toLowerCase()
	              .slice(process.env.PREFIX.length).trim().split(/\s+/);
    const command = args.shift();

    if (!client.commands.has(command)) return;

    const command_obj = client.commands.get(command);
    for (const arg of args) {
        if (!command_obj.recognized_args.includes(arg)) {
            message.channel.send('Unrecognized argument ' + arg);
	    message.channel.send(command_obj.usage);
	    return;
	}
    }

    command_obj.execute(message, args);
});

client.login(process.env.TOKEN);
