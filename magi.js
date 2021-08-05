const dotenv = require('dotenv');
dotenv.config();

const Discord = require('discord.js');
const client = new Discord.Client();

client.once('ready', () => {
    client.channels.cache.get('746086612697350228').send('Real Dyno Hours Worker');
});

client.login(process.env.TOKEN);
