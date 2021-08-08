const Discord = require('discord.js')
const fs = require('fs');

module.exports = {
	name: 'archive',
	usage: 'Usage: ' + process.env.PREFIX + 
	       'archive ((help | metadata | participants | complete) | (text (reactions | stickers | attachments)* | whole-messages)) messages-only?',
	description: 'Creates a .json representation of what you choose to archive and uploads it to the same channel that the command was executed in.\n\nArguments:\n\nmetadata - only captures guild and channel information.\nparticipants - only captures information about who has ever participated in the channel.\ncomplete - will capture metadata, participants, and message content, reactions, stickers, and attatchments.\nhelp - will send the usage and this message to the channel.\n\nOnly one of these arguments can be chosen, and with no trailing arguments, if used. If none of those arguments were used then you can choose how much you want to archive by specifying:\n\ntext - will archive only the textual content for each message. Follow up with "reactions", "stickers", and/or "attachments" to choose what else to capture.\nwhole-messages - will capture textual content, reactions, stickers, and attachments for each message.\nmessages-only - used to ignore metadata and participants.',
	execute(message, args) {
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
		//message.channel.send(this.usage);
		//message.channel.send(this.description);
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
	channel_nsfw: channel.nsfw
    };

    // Add message info to the channel_data
    let messages = await get_channel_messages(channel);
    let [extracted_messages, participants] = extract_message_data(messages);
    channel_data.channel_participants_count = 0;
    channel_data.channel_participants = participants;
    channel_data.channel_participants_count = participants.size;
    channel_data.channel_message_count = 0;
    channel_data.channel_messages = extracted_messages;
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
// Also extracts info about all those who have ever sent a message
// Returns a new <Collection> (snowflake, object), the original is not modified
// and a new <Collection> (user snowflake, participant object) as
// [extracted messages collection, participant collection]
function extract_message_data(message_collection) {
    let extracted_collection = new Discord.Collection();
    let participants = new Discord.Collection();

    message_collection.each((message) => {
        let extracted_data = {
	    id: message.id,
            author: message.author.tag,
	    time: message.createdAt,
	    text: message.content
	};
	if (message.pinned) {
            extracted_data.pinned = true;
	}
        extracted_collection.set(message.id, extracted_data);

	if (!participants.has(message.author.tag)) {
	    let participant = {
		id: message.author.id,
                tag: message.author.tag,
	        pfp: message.author.displayAvatarURL({dynamic: true})
	    };
	    participants.set(message.author.tag, participant);
	}
    });

    return [extracted_collection, participants];
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
