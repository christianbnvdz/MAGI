const Discord = require('discord.js')
const fs = require('fs');

module.exports = {
	name: 'archive',
	usage: 'Usage: ' + process.env.PREFIX + 
	       'archive ((help | metadata | participants | complete) | (text (reactions | stickers | attachments)* | whole-messages) messages-only?)',
	recognized_arguments: ['help', 'metadata', 'participants', 'complete', 'text', 'reactions', 'stickers', 'attachments', 'whole-messages', 'messages-only'],
	description: 'Creates a .json representation of what you choose to archive and uploads it to the same channel that the command was executed in.\n\nArguments:\n\nmetadata - only captures guild and channel information.\nparticipants - only captures information about who has ever participated in the channel.\ncomplete - will capture metadata, participants, and message content, reactions, stickers, and attachments.\nhelp - will send the usage and this message to the channel.\n\nOnly one of these arguments can be chosen with no other arguments accompanying it. If none of those arguments were used then you can choose how much you want to archive by specifying:\n\ntext - will capture only the textual content for each message. Follow up with "reactions", "stickers", and/or "attachments" to choose what else to capture.\nwhole-messages - will capture textual content, reactions, stickers, and attachments for each message.\nmessages-only - used to ignore metadata and participants since they are captured by default.',
	execute(message, args) {
	    if (!is_valid_command(args, message.channel)) {return;}

	    switch (args[0]) {
                case 'help':
		    message.channel.send(this.usage);
		    message.channel.send(this.description);
	            break;
		case 'metadata':
		    message.channel.send('metadata not implemented');
		    break;
		case 'participants':
                    message.channel.send('participants not implemented');
		    break;
	        case 'complete':
		    message.channel.send('complete not implemented');
		    break;
		case 'text':
	            archive_channel(message.channel);
	            message.channel.send('No arguments supported. Saving remotely');
	            break;
		case 'whole-messages':
		    message.channel.send('whole-messages not implemented');
	            break;
	        default:
	            console.log('none of the above dispatch');
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

// args is a javascript array and channel is a TextChannel
// if anything goes wrong the user is sent a message in the
// TextChannel and stops the command execution. Returns bool.
function is_valid_command(args, channel) {
    if (args.length === 0) {
        channel.send('No argument provided.');
	channel.send(module.exports.usage);
        return false;
    }

    if (args.includes('help') || args.includes('metadata') ||
	args.includes('participants') || args.includes('complete')) {
	if (args.length !== 1) {
	    channel.send('Arguments "help", "metadata", "participants", and "complete" can\'t be accompanied by other arguments.');
	    channel.send(module.exports.usage);
            return false;
	} else {
            return true;
	}
    }

    if (args[0] !== 'text' && args[0] !== 'whole-messages') {
        channel.send('"text" or "whole-messages" must be specified before other arguments.');
	channel.send(module.exports.usage);
	return false;
    } else if (args[0] === 'whole-messages') {
        if (args.length > 2) {
            channel.send('Too many arguments for "whole-messages".');
	    channel.send(module.exports.usage);
            return false;
	} else if (args.length === 2 && args[1] !== 'messages-only') {
	    channel.send('"messages-only" is the only argument that can come after "whole-messages".');
	    channel.send(module.exports.usage);
            return false;
	}
	return true;
    } else {
        // Assume that any arguments after 'text' are recognized. Order and
        // duplicates dont matter.
	return true;
    }
}
