const dotenv = require('dotenv');
dotenv.config();

const Discord = require('discord.js');
const client = new Discord.Client();

client.once('ready', () => {
    //client.channels.cache.get('746086612697350228').send('Hello, I am back.');
});

client.on('message', message => {
    if (!message.content.startsWith(process.env.PREFIX) || message.author.bot) return;

    const args = message.content.slice(process.env.PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();
});

client.login(process.env.TOKEN);
