const Discord = require('discord.js')
const fs = require('fs');

module.exports = {
	name: 'archive',
	usage: 'Usage: ' + process.env.PREFIX + 
	       'archive ((help | metadata | participants | complete) | (text (reactions | stickers | attachments | threads)* | whole-messages) messages-only?)',
	recognized_arguments: ['help', 'metadata', 'participants', 'complete', 'text', 'reactions', 'stickers', 'attachments', 'threads', 'whole-messages', 'messages-only'],
	description: 'Creates a .json representation of what you choose to archive and uploads it to the same channel that the command was executed in.\n\nArguments:\n\nmetadata - only captures guild and channel information.\nparticipants - only captures information about who has ever participated in the channel.\ncomplete - will capture metadata, participants, and message content, reactions, stickers, and attachments.\nhelp - will send the usage and this message to the channel.\n\nOnly one of these arguments can be chosen with no other arguments accompanying it. If none of those arguments were used then you can choose how much you want to archive by specifying:\n\ntext - will capture only the textual content for each message. Follow up with "reactions", "stickers", "attachments", and/or "threads" to choose what else to capture.\nwhole-messages - will capture textual content, reactions, stickers, and attachments for each message.\nmessages-only - used to ignore metadata and participants since they are captured by default.\n\nOnly the guild owner can execute this command.\n\nPlease note that I plan on implementing stickers capture but I do not have nitro to test it out.',
	async execute(message, args) {
	    if (message.guild.ownerId !== message.author.id) {
                message.channel.send('Only the guild owner can execute this command.');
	        return;
	    }

	    if (!is_valid_command(args, message.channel)) {return;}

            if (args[0] === 'help') {
                message.channel.send(this.usage);
		message.channel.send(this.description);
		return;
	    };

            let archived_data = {};
	    let out_file = '';

	    const invoked_time = (new Date()).toISOString();

	    switch (args[0]) {
		case 'metadata':
		    archived_data = get_metadata(message.channel);
	            out_file = 'metadata';
		    break;
		case 'participants':
                    args = ['text', 'reactions'];
                    archived_data = await get_data(message.channel, args);
	            archived_data = archived_data.participant_data.participants;
	            out_file = 'participants';
		    break;
	        case 'complete':
		    args = ['text', 'reactions', 'stickers', 'attachments', 'threads'];
		    archived_data = await get_data(message.channel, args);
		    out_file = 'complete_archive';
		    break;
		case 'text':
	            archived_data = await get_data(message.channel, args);
		    out_file = 'channel_archive';
	            break;
		case 'whole-messages':
		    let only_message_data = false;
		    if (args.length === 2) {only_message_data = true;}
		    args = ['text', 'reactions', 'stickers', 'attachments', 'threads'];
		    if (only_message_data) {
		        args.push('messages-only');
		    }
		    archived_data = await get_data(message.channel, args);
	            out_file = 'channel_archive';
	            break;
	        default:
	            console.log('none of the above dispatch');
	    }

	    out_file += '_' + invoked_time + '.json';

            // This is an async function but it doesn't matter to us how
	    // long it takes to get there. Nothing here depends on it.
	    send_JSON_file(message.channel, out_file, archived_data);
	}
};

// Takes a TextChannel and an argument array
// Decides how to prepare data in a channel based on the args
// array given. Returns an object holding all the data.
async function get_data(channel, args) {
    let data;

    let messages = await get_channel_messages(channel);
    let [message_data, participants] = await get_message_data(messages, args);

    if (args.includes('stickers')) {
        channel.send('The stickers argument is not implemented.');
    }

    if (args.includes('messages-only')) {
        data = message_data;
    } else {
        data = {metadata: get_metadata(channel)};
	data.participant_data = {
            participant_count: participants.size,
	    participants: participants
	};
	data.message_data = {
            message_count: message_data.size,
	    messages: message_data
	};
    }

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
	guild_owner_id: channel.guild.ownerId,
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

// Takes a <Collection> (snowflake, message) and args as input
// Extracts only desired information from each message in the collection
// Also extracts info about all those who have ever sent a message
// Returns a new <Collection> (snowflake, object), the original is not modified
// and a new <Collection> (user tag, participant object) as
// [extracted messages collection, participant collection]
async function get_message_data(message_collection, args) {
    let extracted_collection = new Discord.Collection();
    let participants = new Discord.Collection();

    for (const [snowflake, message] of message_collection) {
        //Basic message_data
	let extracted_data = {
            id: message.id,
	    author: message.author.tag,
	    time: message.createdAt,
	    text: message.content
	};

	if (message.pinned) {
            extracted_data.pinned = true;
	}
	if (message.type === 'REPLY') {
            extracted_data.replying_to = message.reference.messageId;
	}
	// Only true if it's a message in a thread
	if (message.channel.type === 'GUILD_NEWS_THREAD' ||
	    message.channel.type === 'GUILD_PUBLIC_THREAD' ||
	    message.channel.type === 'GUILD_PRIVATE_THREAD') {
            extracted_data.thread_id = message.channelId;
	}

	if (args.includes('reactions')) {
            extracted_data.reactions = [await get_reaction_data(message, participants)];
	}

	if (args.includes('attachments')) {
	    extracted_data.attachments = [get_attachments(message)];
	}

	extracted_collection.set(message.id, extracted_data);
	update_user_collection(participants, message.author);
	if (message.type === 'GUILD_MEMBER_JOIN') {
            participants.get(message.author.tag).joined = message.createdAt;
	}

	// This will never be true for messages that are in threads
	if (args.includes('threads') && message.hasThread) {
	    extracted_data.spawned_thread = true;
	    extracted_data.thread_id = message.thread.id;
            const thread_messages = await get_channel_messages(message.thread);
	    const [messages, thread_participants] = await get_message_data(thread_messages, args);
            // join messages and participants
	    extracted_collection = extracted_collection.concat(messages);
	    for (const [tag, participant_info] of thread_participants) {
                if (!participants.has(tag)) {
                    participants.set(tag, participant_info);
		}
	    }
	}

    }
    return [extracted_collection, participants];
}

// Takes a Message
// Extracts the attachments from a message and returns an
// object containing the url, the name, and the size of the
// attachment
function get_attachments(message) {
    let attachment_data = {};
    let attachment_collection = message.attachments;
    if (attachment_collection.size > 0) {
        // It appears that there is only ever one attachment per message
        let attachment = attachment_collection.first();
	attachment_data = {
            id: attachment.id,
            spoiler: attachment.spoiler,
	    name: attachment.name,
	    url: attachment.url,
	    size: attachment.size
	};
    }

    return attachment_data;
}

// Takes a Message
// Also takes in a Collection of participants to update
// in case a new participant is found.
// Extracts reaction data and returns an object containing
// Each reaction and the users that reacted with it
async function get_reaction_data(message, participants) {
    let reaction_data = {};
    let reactions = message.reactions.cache;

    for (const [emoji_string, reaction] of reactions) {
        reaction_data[reaction.emoji.name] = await get_reactors(reaction.users, participants);
    }

    return reaction_data;
}

// Takes a ReactionUserManager
// Also takes in a Collection of Participants
// Returns an array contaning the tag of each user who
// interacted with the reaction. Currently only a max of 100
// users are gathered. No more than that will be captured
async function get_reactors(reaction_manager, participants) {
    let user_data = [];
    let users = await reaction_manager.fetch();
    users.each((user) => {
        user_data.push(user.tag);
	update_user_collection(participants, user);
    });
    return user_data;
}

// Takes a Collection of participants and a User
// Checks to see if the User is in the participants collection
// and adds them to it if they aren't
// MODIFIES THE REFERENCED COLLECTION
function update_user_collection(participant_collection, user) {
    if (!participant_collection.has(user.tag)) {
        let participant = {
            id: user.id,
            tag: user.tag,
	    pfp: user.displayAvatarURL({dynamic: true})
	};
	participant_collection.set(user.tag, participant);
    }
}

// Get all the messages from a channel of type TextChannel
// Returns all the channel messages as <Collection> (snowflake, message)
// Messages are from newest to oldest
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
// TextChannel and stops the command execution. Returns bool
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
