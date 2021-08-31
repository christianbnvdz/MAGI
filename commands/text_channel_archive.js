import {Collection} from 'discord.js';
import {createReadStream, createWriteStream} from 'fs';
import {rm, writeFile} from 'fs/promises';
import process from 'process';
import {pipeline} from 'stream/promises';
import {createGzip} from 'zlib';

// The maximum number of messages Discord.js lets you fetch at a time
const MESSAGE_FETCH_LIMIT = 100;

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

  generateArchiveFiles(message, args);
}

export {NAME, USAGE, RECOGNIZED_ARGS, DESCRIPTION, execute};

// Takes a Message and arg array
// generates all the archive files requested based on args
async function generateArchiveFiles(message, args) {
  switch (args[0]) {
    case 'metadata':
      generateMetadataFile(message.channel);
      break;
    case 'participants':
      args = ['text', 'reactions', 'threads'];
      message.channel.send('Participants argument is currently unsupported.');
      break;
    case 'complete':
      args = ['text', 'reactions', 'stickers', 'attachments', 'threads'];
      generateChannelFiles(message.channel, args);
      break;
    case 'text':
      generateChannelFiles(message.channel, args);
      break;
    case 'whole-messages':
      let onlyMessageData = (args.length === 2);
      args = ['text', 'reactions', 'stickers', 'attachments', 'threads'];
      if (onlyMessageData) args.push('messages-only');
      generateChannelFiles(message.channel, args);
      break;
    default:
      console.log('none of the above dispatch');
  }
}

// Takes a TextChannel and an argument array
// Generates the channel's files based on args
async function generateChannelFiles(channel, args) {
  let data;
  let [messageData, participants] = await prepareMessageData(channel, args);

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
// Generates the metadata json file for the channel
function generateMetadataFile(channel) {
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

// Takes a TextChannel and args as input
// Also extracts info about all those who have ever sent a message
// Returns a <Collection> (snowflake, messageObj) holding all messages in the
// channel with the desired information and a new
// <Collection> (user tag, participantObj) as
// [extracted messages collection, participant collection]
async function prepareMessageData(channel, args) {
  let extractedMessages = new Collection();
  let participants = new Collection();

  // Holds a promise
  let messagesFetched;
  // The actual messages fetched
  let fetchedMessageSet = new Collection();
  let lastSnowflake = null;
  // For holding extracted data of the fetchedMessageSet
  let messageData;
  let userData;

  do {
    messagesFetched = getChannelMessages(channel, lastSnowflake);

    [messageData, userData] = await extractMessageData(fetchedMessageSet, args);

    messagesFetched.then((messages) => {
      fetchedMessageSet = messages;
      lastSnowflake = fetchedMessageSet.lastKey();
    });

    // Combine message data and user data
    extractedMessages = extractedMessages.concat(messageData);
    // Will update the participants list with join information
    // since messages are from newest to oldest. Can be more efficient.
    for (const [tag, user] of userData) {
      participants.set(tag, user);
    }

    await messagesFetched;

  } while (fetchedMessageSet.size === MESSAGE_FETCH_LIMIT);

  if (fetchedMessageSet.size !== 0) {
    [messageData, userData] = await extractMessageData(fetchedMessageSet, args);
    extractedMessages = extractedMessages.concat(messageData);
    for (const [tag, user] of userData) {
      participants.set(tag, user);
    }
  }

  return [extractedMessages, participants];
}

// Takes a collection of messages and arg array
// Extracts data specified in args from each message
// in the collection.
// Returns a <Collection> (snowflake, messageObj) and
// <Collection> (user tag, participantObj) as
// [extracted messages collection, participant collection]
async function extractMessageData(messageCollection, args) {
  let extractedMessages = new Collection();
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

    extractedMessages.set(message.id, extractedData);
    updateUserCollection(participants, message.author);
    if (message.type === 'GUILD_MEMBER_JOIN') {
      participants.get(message.author.tag).joined = message.createdAt;
    }

    // This will never be true for messages that are in threads
    if (args.includes('threads') && message.hasThread) {
      extractedData.spawnedThread = true;
      extractedData.threadId = message.thread.id;
      const [threadMessages, threadParticipants] =
          await prepareMessageData(message.thread, args);
      // join messages and participants
      extractedMessages = extractedMessages.concat(threadMessages);
      for (const [tag, participantInfo] of threadParticipants) {
        participants.set(tag, participantInfo);
      }
    }
  }

  return [extractedMessages, participants];
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

// Takes a TextChannel and an optional snowflake
// Get a maximum of 100 messages in a channel starting at the
// specified snowflake.
// If snowflake is null then starts from most recent message in the channel.
// Returns a Promise of <Collection> (snowflake, message)
// Messages in returned collection are from newest to oldest
function getChannelMessages(channel, snowflake = null) {
  const fetchOptions = {limit: MESSAGE_FETCH_LIMIT, before: snowflake};

  return channel.messages.fetch(fetchOptions);
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
