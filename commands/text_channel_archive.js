const Discord = require('discord.js')
const fs = require('fs');

module.exports = {
	name: 'archive',
	usage: 'Usage: ' + process.env.PREFIX + 'archive (help | text)',
	description: 'Creates a .json archive file of the channel in its current state and uploads it to the same channel where the command was executed. Guild information and channel information is always included. The argument given determines how much of the channel gets archived. "text" will only capture content from messages. "help" displays the usage along with this message.',
	execute(message, args) {
            console.log(args);
	    if (args.length == 0) {
                console.log('No argument passed.');
		console.log(this.usage);
		return;
	    } else if (args.length > 1) {
                console.log('Too many arguments supplied.');
		console.log(this.usage);
		return;
	    }

	    if (args[0] === 'text') {
                const channel_as_json = scrape_channel(message.channel);
            } else if (args[0] === 'help') {
                console.log(this.usage);
		console.log(this.description);
	    } else {
                console.log('Bad argument.');
		console.log(this.usage);
	    }
	},
};

// channel is of type TextChannel
async function scrape_channel(channel) {
    // Only allowed to grab 100 messages at a time
    let messages = await channel.messages.fetch({limit: 100});
    let messages_retreived = messages.size;
    while (messages_retreived === 100) {
        const message_batch = await channel.messages.fetch({limit: 100, before: messages.lastKey()});
	messages = messages.concat(message_batch);
	messages_retreived = message_batch.size;
    }

    // Get general channel info
    let channel_data = {
	guild_id: channel.guild.id,
	guild_name: channel.guild.name,
	guild_description: channel.guild.description,
	guild_creation_date: channel.guild.createdAt,
	guild_owner_id: channel.guild.ownerID,
        channel_id: channel.id,
	channel_name: channel.name,
	channel_topic: channel.topic,
	channel_creation_date: channel.createdAt,
	//channel_members:channel.members,        cant get this to work quite yet. Only cached members
	channel_nsfw: channel.nsfw,
	channel_message_count: 0,
	channel_messages: new Discord.Collection(),
    };

    if (messages.size > 0) {
	// Extract only the data we want from messages
	messages.each((message) => {
            let message_data = {
		message_author_id: message.author.id,
		message_author: message.author.tag,
		message_author_pfp: message.author.displayAvatarURL({dynamic: true}),
		message_id: message.id,
		message_send_time: message.createdAt,
		message_text: message.content
	    };
	    // Use the message snowflake as the key
	    channel_data.channel_messages.set(message.id, message_data);
	});
	// also store the number of messages in the channel
	channel_data.channel_message_count = channel_data.channel_messages.size;
    }
    console.log(channel_data);
    /*fs.writeFile('channel_archive.json', JSON.stringify(channel_data), 'utf8', () => {});
    await channel.send({
	files: [{
	    attachment: './channel_archive.json',
	    name: 'channel_archive.json'
	}]
    });*/
}
