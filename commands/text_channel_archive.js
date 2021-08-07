const Discord = require('discord.js')
const fs = require('fs');

module.exports = {
	name: 'archive',
	usage: 'Usage: ' + process.env.PREFIX + 'archive (help | text)',
	description: 'Creates a .json archive file of the channel in its current state and uploads it to the same channel where the command was executed. Guild information and channel information is always included. The argument given determines how much of the channel gets archived. "text" will only capture content from messages. "help" displays the usage along with this message.',
	execute(message, args) {
            console.log('Args: ' + args);
	    if (args.length == 0) {
                console.log('No argument supplied.');
		console.log(this.usage);
		return;
	    } else if (args.length > 1) {
                console.log('Too many arguments supplied.');
		console.log(this.usage);
		return;
	    }

	    if (args[0] === 'text') {
                archive_channel(message.channel);
            } else if (args[0] === 'help') {
                console.log(this.usage);
		console.log(this.description);
	    } else {
                console.log('Bad argument.');
		console.log(this.usage);
	    }
	}
};

// Takes a TextChannel as input
// Prints the channel data to the console
async function archive_channel(channel) {
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
	channel_nsfw: channel.nsfw,
	channel_message_count: 0
    };

    // Add message info to the channel_data
    let messages = await get_channel_messages(channel);
    channel_data.channel_messages = extract_message_data(messages);
    channel_data.channel_message_count = channel_data.channel_messages.size;

    // Print the result to the console
    console.log(channel_data);

    /*fs.writeFile('channel_archive.json', JSON.stringify(channel_data), 'utf8', () => {});
    await channel.send({
	files: [{
	    attachment: './channel_archive.json',
	    name: 'channel_archive.json'
	}]
    });*/
}

// Takes a <Collection> (snowflake, message) as input
// Extracts only desired information from each message in the collection
// Returns a new <Collection> (snowflake, object), the original is not modified
function extract_message_data(message_collection) {
    let extracted_collection = new Discord.Collection();

    message_collection.each((message) => {
        let extracted_data = {
            author_id: message.author.id,
            author: message.author.tag,
            author_pfp: message.author.displayAvatarURL({dynamic: true}),
	    send_time: message.createdAt,
	    text: message.content
	};
	extracted_collection.set(message.id, extracted_data);
    });

    return extracted_collection;
}

// Get all the messages from a channel of type TextChannel
// Returns all the channel messages as <Collection> (snowflake, message)
// Messages are from newest to oldest.
async function get_channel_messages(channel) {
    // Discord.js only allows fetching a max of 100 messages each time
    let fetch_options = {limit: 100};
    let messages = await channel.messages.fetch(fetch_options);
    let messages_retreived = messages.size;

    while (messages_retreived === 100) {
	fetch_options.before = messages.lastKey();
        const message_batch = await channel.messages.fetch(fetch_options);
        messages = messages.concat(message_batch);
	messages_retreived = message_batch.size;
    }

    return messages;
}
