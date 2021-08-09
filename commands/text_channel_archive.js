const Discord = require('discord.js')
const fs = require('fs');

module.exports = {
	name: 'archive',
	usage: 'Usage: ' + process.env.PREFIX + 
	       'archive ((help | metadata | participants | complete) | (text (reactions | stickers | attachments)* | whole-messages) messages-only?)',
	recognized_arguments: ['help', 'metadata', 'participants', 'complete', 'text', 'reactions', 'stickers', 'attachments', 'whole-messages', 'messages-only'],
	description: 'Creates a .json representation of what you choose to archive and uploads it to the same channel that the command was executed in.\n\nArguments:\n\nmetadata - only captures guild and channel information.\nparticipants - only captures information about who has ever participated in the channel.\ncomplete - will capture metadata, participants, and message content, reactions, stickers, and attachments.\nhelp - will send the usage and this message to the channel.\n\nOnly one of these arguments can be chosen with no other arguments accompanying it. If none of those arguments were used then you can choose how much you want to archive by specifying:\n\ntext - will capture only the textual content for each message. Follow up with "reactions", "stickers", and/or "attachments" to choose what else to capture.\nwhole-messages - will capture textual content, reactions, stickers, and attachments for each message.\nmessages-only - used to ignore metadata and participants since they are captured by default.',
	async execute(message, args) {
	    if (!is_valid_command(args, message.channel)) {return;}

            if (args[0] === 'help') {
                message.channel.send(this.usage);
		message.channel.send(this.description);
		return;
	    };

            let archived_data = {};
	    let out_file = '';

	    switch (args[0]) {
		case 'metadata':
		    archived_data = get_metadata(message.channel);
	            out_file = 'metadata';
		    break;
		case 'participants':
                    message.channel.send('participants may not be implemented');
	            out_file = 'participants';
		    return;
	        case 'complete':
		    message.channel.send('complete not implemented');
		    //args = ['text', 'reactions', 'stickers', 'attachments'];
		    //archived_data = await get_data(message.channel, args);
		    out_file = 'complete_archive;
		    return;
		case 'text':
	            archived_data = await get_data(message.channel, args);
		    out_file = 'channel_archive';
	            break;
		case 'whole-messages':
		    message.channel.send('whole-messages not implemented');
		    //let only_message_data = false;
		    //if (args.length === 2) {only_message_data = true;}
		    //args = ['text', 'reactions', 'stickers', 'attachments'];
		    //if (only_message_data) {
		    //    args.push('messages-only');
		    //}
		    //archived_data = await get_data(message.channel, args);
	            out_file = 'channel_archive';
	            return;
	        default:
	            console.log('none of the above dispatch');
	    }

	    out_file += '_' + (new Date()).toISOString() + '.json';

            // This is an async function but it doesn't matter to us how
	    // long it takes to get there. Nothing here depends on it.
	    send_JSON_file(message.channel, out_file, archived_data);
	}
};

// Takes a TextChannel and an argument array
// Decides how to prepare data in a channel based on the args
// array given. Returns an object holding all the data.
async function get_data(channel, args) {
    let data = {metadata: get_metadata(channel)};
    let messages = await get_channel_messages(channel);
    let [message_data, participants] = get_message_data(messages);

    data.participant_data = {
        participant_count: participants.size,
	participants: participants
    };
    
    data.message_data = {
        message_count: message_data.size,
	messages: message_data
    };

    return data;
}

// Takes a TextChannel as input
// Returns an object with metadata of the guild and channel
function get_metadata(channel) {
    const metadata = {
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
    return metadata;
}

// Takes a TextChannel
// Takes a string consisting of the filename (including extension)
// Takes the archive object to send in that file
// Sends the information in the archive object to the channel
async function send_JSON_file(channel, filename, archive_obj) {
    fs.writeFile(filename, JSON.stringify(archive_obj), 'utf8', () => {});
    await channel.send({
	files: [{
	    attachment: `./${filename}`,
	    name: filename
	}]
    });
}

// Takes a <Collection> (snowflake, message) as input
// Extracts only desired information from each message in the collection
// Also extracts info about all those who have ever sent a message
// Returns a new <Collection> (snowflake, object), the original is not modified
// and a new <Collection> (user snowflake, participant object) as
// [extracted messages collection, participant collection]
function get_message_data(message_collection) {
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
