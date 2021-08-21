import {Collection} from 'discord.js';
import {createReadStream, createWriteStream} from 'fs';
import {rm, writeFile} from 'fs/promises';
import process from 'process';
import {pipeline} from 'stream/promises';
import {createGzip} from 'zlib';

const NAME = 'archive';
const USAGE = `Usage: ${process.env.PREFIX}archive ((help | metadata | participants | complete) | (text (reactions | stickers | attachments | threads)* | whole-messages) messages-only?)`;
const RECOGNIZED_ARGS = [
  'help', 'metadata', 'participants', 'complete', 'text', 'reactions',
  'stickers', 'attachments', 'threads', 'whole-messages', 'messages-only'
];
const DESCRIPTION = 'Creates a .json representation of what you choose to archive and uploads it to the same channel that the command was executed in.\n\nmetadata - only captures guild and channel information.\nparticipants - only captures information about who has ever participated in the channel.\ncomplete - captures everything (see Capture Selection).\nhelp - will send the usage and this message to the channel.\n\nCapture Selection:\ntext - will capture only the textual content for each message. Follow up with "reactions", "stickers", "attachments", and/or "threads" to choose what else to capture.\nwhole-messages - captures everything.\nmessages-only - used to ignore metadata and participants since they are captured by default.\n\nOnly the guild owner can execute this command.';

async function execute(message, args) {
  if (message.guild.ownerId !== message.author.id) {
    message.channel.send('Only the guild owner can execute this command.');
    return;
  }

  if (!isValidCommand(args, message.channel)) return;

  if (args[0] === 'help') {
    message.channel.send(`${USAGE}\n${DESCRIPTION}`);
    return;
  };

  const invokedTime = (new Date()).toISOString();
  const [archivedData, filename] = await getArchiveData(message, args);

  sendArchivedFile(
      message.channel, `${filename}_${invokedTime}.json`, archivedData);
}

export {NAME, USAGE, RECOGNIZED_ARGS, DESCRIPTION, execute};

// Takes a Message and arg array
// Returns the archive object and the filename
// the filename specifies what is getting archived
async function getArchiveData(message, args) {
  let archivedData = {};
  let filename = '';

  switch (args[0]) {
    case 'metadata':
      archivedData = getMetadata(message.channel);
      filename = 'metadata';
      break;
    case 'participants':
      args = ['text', 'reactions'];
      archivedData = await getChannelData(message.channel, args);
      archivedData = archivedData.participantData.participants;
      filename = 'participants';
      break;
    case 'complete':
      args = ['text', 'reactions', 'stickers', 'attachments', 'threads'];
      archivedData = await getChannelData(message.channel, args);
      filename = 'complete_archive';
      break;
    case 'text':
      archivedData = await getChannelData(message.channel, args);
      filename = 'channel_archive';
      break;
    case 'whole-messages':
      let onlyMessageData = false;
      if (args.length === 2) {
        onlyMessageData = true;
      }
      args = ['text', 'reactions', 'stickers', 'attachments', 'threads'];
      if (onlyMessageData) {
        args.push('messages-only');
      }
      archivedData = await getChannelData(message.channel, args);
      filename = 'channel_archive';
      break;
    default:
      console.log('none of the above dispatch');
  }

  return [archivedData, filename];
}

// Takes a TextChannel and an argument array
// Decides how to prepare data in a channel based on the args
// array given. Returns an object holding all the data.
async function getChannelData(channel, args) {
  let data;

  let messages = await getChannelMessages(channel);
  let [messageData, participants] = await extractMessageData(messages, args);

  if (args.includes('messages-only')) {
    data = messageData;
  } else {
    data = {metadata: getMetadata(channel)};
    data.participantData = {
      participantCount: participants.size,
      participants: participants
    };
    data.messageData = {messageCount: messageData.size, messages: messageData};
  }

  return data;
}

// Takes a TextChannel as input
// Returns an object with metadata of the guild and channel
function getMetadata(channel) {
  const metadata = {
    guildId: channel.guild.id,
    guildName: channel.guild.name,
    guildDescription: channel.guild.description,
    guildIcon: channel.guild.iconURL({dynamic: true}),
    guildCreationDate: channel.guild.createdAt,
    guildOwnerId: channel.guild.ownerId,
    channelId: channel.id,
    channelName: channel.name,
    channelTopic: channel.topic,
    channelCreationDate: channel.createdAt,
    channelNsfw: channel.nsfw
  };
  return metadata;
}

// Takes a TextChannel
// Takes a string consisting of the filename (including extension)
// Takes the archive object to send in that file
// Sends the information in the archive object to the channel
// after compressing using gzip
async function sendArchivedFile(channel, filename, archiveObj) {
  const gzip = createGzip();
  const ext = '.gz';

  await writeFile(filename, JSON.stringify(archiveObj), 'utf8');

  const source = createReadStream(filename);
  const destination = createWriteStream(filename + ext);

  await pipeline(source, gzip, destination);

  await channel.send(
      {files: [{attachment: `./${filename + ext}`, name: filename + ext}]});

  rm(filename);
  rm(filename + ext);
}

// Takes a <Collection> (snowflake, message) and args as input
// Extracts only desired information from each message in the collection
// Also extracts info about all those who have ever sent a message
// Returns a new <Collection> (snowflake, object), the original is not modified
// and a new <Collection> (user tag, participant object) as
// [extracted messages collection, participant collection]
async function extractMessageData(messageCollection, args) {
  let extractedCollection = new Collection();
  let participants = new Collection();

  for (const [snowflake, message] of messageCollection) {
    // Basic messageData
    let extractedData = {
      id: message.id,
      author: message.author.tag,
      time: message.createdAt,
      text: message.content
    };

    if (message.pinned) {
      extractedData.pinned = true;
    }

    if (message.type === 'REPLY') {
      // Even if the message was deleted the snowflake is still there
      extractedData.replyingTo = message.reference.messageId;
    }

    // Only true if it's a message in a thread
    if (message.channel.type === 'GUILD_NEWS_THREAD' ||
        message.channel.type === 'GUILD_PUBLIC_THREAD' ||
        message.channel.type === 'GUILD_PRIVATE_THREAD') {
      extractedData.threadId = message.channelId;
    }

    if (args.includes('reactions')) {
      extractedData.reactions = [await getReactions(message, participants)];
    }

    if (args.includes('stickers')) {
      extractedData.stickers = getStickers(message);
    }

    if (args.includes('attachments')) {
      extractedData.attachments = getAttachments(message);
    }

    extractedCollection.set(message.id, extractedData);
    updateUserCollection(participants, message.author);
    if (message.type === 'GUILD_MEMBER_JOIN') {
      participants.get(message.author.tag).joined = message.createdAt;
    }

    // This will never be true for messages that are in threads
    if (args.includes('threads') && message.hasThread) {
      extractedData.spawnedThread = true;
      extractedData.threadId = message.thread.id;
      const threadMessages = await getChannelMessages(message.thread);
      const [messages, threadParticipants] =
          await extractMessageData(threadMessages, args);
      // join messages and participants
      extractedCollection = extractedCollection.concat(messages);
      for (const [tag, participantInfo] of threadParticipants) {
        if (!participants.has(tag)) {
          participants.set(tag, participantInfo);
        }
      }
    }
  }

  return [extractedCollection, participants];
}

// Takes a Message
// Extracts the stickers from a message and returns an array of
// sticker objects that hold info about each sticker
function getStickers(message) {
  let stickers = [];
  // Not sure how a message can have multiple stickers but it may happen
  for (const [snowflake, sticker] of message.stickers) {
    let stickerInfo = {
      id: sticker.id,
      name: sticker.name,
      url: sticker.url,
      creator: sticker.user.tag
    };

    stickers.push(stickerInfo);
  }

  return stickers;
}

// Takes a Message
// Extracts the attachments from a message and returns an
// array of attachment objects that hold info about that attachment
function getAttachments(message) {
  let attachments = [];
  // Mobile users can send multiple attachments per message
  for (const [snowflake, attachment] of message.attachments) {
    let attachmentInfo = {
      id: attachment.id,
      spoiler: attachment.spoiler,
      name: attachment.name,
      url: attachment.url,
      size: attachment.size
    };

    attachments.push(attachmentInfo);
  }

  return attachments;
}

// Takes a Message
// Also takes in a Collection of participants to update
// in case a new participant is found.
// Extracts reaction data and returns an object containing
// Each reaction and the users that reacted with it
async function getReactions(message, participants) {
  let reactionData = {};
  let reactions = message.reactions.cache;

  for (const [emojiString, reaction] of reactions) {
    reactionData[reaction.emoji.name] =
        await getReactors(reaction.users, participants);
  }

  return reactionData;
}

// Takes a ReactionUserManager
// Also takes in a Collection of Participants
// Returns an array contaning the tag of each user who
// interacted with the reaction. Currently only a max of 100
// users are gathered. No more than that will be captured
async function getReactors(reactionManager, participants) {
  let userData = [];
  let users = await reactionManager.fetch();

  users.each((user) => {
    userData.push(user.tag);
    updateUserCollection(participants, user);
  });

  return userData;
}

// Takes a Collection of participants and a User
// Checks to see if the User is in the participants collection
// and adds them to it if they aren't
// MODIFIES THE REFERENCED COLLECTION
function updateUserCollection(participantCollection, user) {
  if (!participantCollection.has(user.tag)) {
    let participant = {
      id: user.id,
      tag: user.tag,
      pfp: user.displayAvatarURL({dynamic: true})
    };

    participantCollection.set(user.tag, participant);
  }
}

// Get all the messages from a channel of type TextChannel
// Returns all the channel messages as <Collection> (snowflake, message)
// Messages are from newest to oldest
async function getChannelMessages(channel) {
  // Discord.js only allows fetching a max of 100 messages each time
  let fetchOptions = {limit: 100};
  let messages = await channel.messages.fetch(fetchOptions);
  let messagesRetreived = messages.size;

  while (messagesRetreived === 100) {
    fetchOptions.before = messages.lastKey();
    const messageBatch = await channel.messages.fetch(fetchOptions);
    messages = messages.concat(messageBatch);
    messagesRetreived = messageBatch.size;
  }

  return messages;
}

// args is a javascript array and channel is a TextChannel
// if anything goes wrong the user is sent a message in the
// TextChannel and stops the command execution. Returns bool
function isValidCommand(args, channel) {
  if (args.length === 0) {
    channel.send('No argument provided.');
    channel.send(USAGE);
    return false;
  }

  if (args.includes('help') || args.includes('metadata') ||
      args.includes('participants') || args.includes('complete')) {
    if (args.length !== 1) {
      channel.send(
          'Arguments "help", "metadata", "participants", and "complete" can\'t be accompanied by other arguments.');
      channel.send(USAGE);
      return false;
    } else {
      return true;
    }
  }

  if (args[0] !== 'text' && args[0] !== 'whole-messages') {
    channel.send(
        '"text" or "whole-messages" must be specified before other arguments.');
    channel.send(USAGE);
    return false;
  } else if (args[0] === 'whole-messages') {
    if (args.length > 2) {
      channel.send('Too many arguments for "whole-messages".');
      channel.send(USAGE);
      return false;
    } else if (args.length === 2 && args[1] !== 'messages-only') {
      channel.send(
          '"messages-only" is the only argument that can come after "whole-messages".');
      channel.send(USAGE);
      return false;
    }
    return true;
  } else {
    // Assume that any arguments after 'text' are recognized. Order and
    // duplicates dont matter.
    return true;
  }
}
