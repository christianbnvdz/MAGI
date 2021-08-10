const dotenv = require('dotenv');
dotenv.config();

const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

client.once('ready', () => {
    //client.channels.cache.get('746086612697350228').send('Hello, I am back.');
});

client.on('message', message => {
    if (!message.content.startsWith(process.env.PREFIX) || message.author.bot) return;

    const args = message.content.slice(process.env.PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    if (!client.commands.has(command)) return;

    const command_obj = client.commands.get(command);
    for (const arg of args) {
        if (!command_obj.recognized_arguments.includes(arg)) {
            message.channel.send('Unrecognized argument ' + arg);
	    message.channel.send(command_obj.usage);
	    return;
	}
    }

    command_obj.execute(message, args);
});

client.login(process.env.TOKEN);
