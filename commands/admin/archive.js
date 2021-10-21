/**
 * @module commands/admin/archive
 */
import {Buffer} from 'buffer';
import {Collection} from 'discord.js';
import {createReadStream, createWriteStream, existsSync} from 'fs';
import {rm, mkdir, rmdir, writeFile} from 'fs/promises';
import process from 'process';
import {pipeline} from 'stream/promises';
import * as tar from 'tar';
import {createGzip} from 'zlib';

// The maximum number of messages Discord.js lets you fetch at a time
const MESSAGE_FETCH_LIMIT = 100;
// The maximum file size, in bytes, that the bot can upload to a channel
const FILE_UPLOAD_SIZE_LIMIT = 8000000;
// Filenames for known files
const METADATA_FILENAME = 'metadata.json';
const PARTICIPANTS_FILENAME = 'participants.json';
const MESSAGES_0_FILENAME = 'messages_0.json';
const TAR_FILENAME = 'archive.tar';

const NAME = 'archive';
const USAGE = `Usage: ${process.env.PREFIX}${NAME} ((metadata | participants | complete) | (text (reactions | stickers | attachments | threads)* | whole-messages) [messages-only])`;
const DESCRIPTION = 'Creates a .json representation of what you choose to archive and uploads it to the same channel that the command was executed in.\n\nmetadata - only captures guild and channel information.\nparticipants - only captures information about who has ever participated in the channel.\ncomplete - captures everything (see Capture Selection).\nhelp - will send the usage and this message to the channel.\n\nCapture Selection:\ntext - will capture only the textual content for each message. Follow up with "reactions", "stickers", "attachments", and/or "threads" to choose what else to capture.\nwhole-messages - captures everything.\nmessages-only - used to ignore metadata and participants since they are captured by default.\n\nOnly the guild owner can execute this command.';
/**
 * Generates and sends the channel's archive files.
 * @param {Message} message
 * @param {string[]} args
 */
async function execute(message, args) {
  if (!isValidCommand(args, message.channel)) return;

  if (existsSync(`${message.channel.id}`)) {
    message.channel.send(
        `>>> Please wait for the current archive process to finish.`);
    return;
  }

  await mkdir(message.channel.id);
  await generateArchiveFiles(message, args);
  await sendArchiveFiles(message.channel);
  rmdir(message.channel.id);
}

export {NAME, USAGE, DESCRIPTION, isValidCommand, execute};

/**
 * Dispatches the correct function to generate archive files based on the
 * arguments.
 * @param {Message} message
 * @param {string[]} args
 * @return {Promise} The promise indicates when all files have been generated.
 */
function generateArchiveFiles(message, args) {
  let completed;

  switch (args[0]) {
    case 'metadata':
      completed = generateMetadataFile(message.channel);
      break;
    case 'participants':
      args = ['text', 'reactions', 'threads', 'participants'];
      completed = generateChannelFiles(message.channel, args);
      break;
    case 'complete':
      args = ['text', 'reactions', 'stickers', 'attachments', 'threads'];
      completed = generateChannelFiles(message.channel, args);
      break;
    case 'text':
      completed = generateChannelFiles(message.channel, args);
      break;
    case 'whole-messages':
      const onlyMessageData = (args.length === 2);
      args = ['text', 'reactions', 'stickers', 'attachments', 'threads'];
      if (onlyMessageData) args.push('messages-only');
      completed = generateChannelFiles(message.channel, args);
      break;
    default:
      console.log('none of the above dispatch');
  }

  return completed;
}

/**
 * Generates channel archive files based on arguments.
 * @param {TextChannel} channel
 * @param {string[]} args
 * @return {Promise} The promise indicates when all channel files have been
 * generated.
 */
function generateChannelFiles(channel, args) {
  const filePromises = [];

  if (!args.includes('messages-only') && !args.includes('participants'))
    filePromises.push(generateMetadataFile(channel));

  filePromises.push(generateMessageFiles(channel, args));

  return Promise.all(filePromises);
}

/**
 * Generates the channel metadata archive file.
 * @param {TextChannel}
 * @return {Promise} Indicates when the metadata file has generated.
 */
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

  return writeFile(
      `${channel.id}/${METADATA_FILENAME}`, JSON.stringify(metadata), 'utf8');
}

/**
 * Sends the archive files to the channel. Will tar and gzip as needed. All
 * files that are generated eventually get deleted.
 * @param {TextChannel} channel
 * @return {Promise} Indicates when all generated files are sent and deleted
 * from the bots files.
 */
async function sendArchiveFiles(channel) {
  const metadata_path = `${channel.id}/${METADATA_FILENAME}`;
  const participants_path = `${channel.id}/${PARTICIPANTS_FILENAME}`;
  const messages_0_path = `${channel.id}/${MESSAGES_0_FILENAME}`;
  const tar_path = `${channel.id}/${TAR_FILENAME}`;

  const generatedMetadata = existsSync(metadata_path);
  const generatedParticipants = existsSync(participants_path);

  // If only metadata file was generated
  if (generatedMetadata && !generatedParticipants)
    return sendFile(channel, metadata_path, METADATA_FILENAME);
  // If only participants file was generated
  if (generatedParticipants && !generatedMetadata)
    return sendFile(channel, participants_path, PARTICIPANTS_FILENAME);
  // At this point, either both exist or none exist
  // If one exists then message files exist: messages-only wasn't passed
  // If not then just message files exist: messages-only was passed
  let pageNo = 0;
  const deletionPromises = [];

  if (generatedMetadata) {
    pageNo = 1;
    await tar.c(
        {cwd: channel.id, file: tar_path},
        [METADATA_FILENAME, PARTICIPANTS_FILENAME, MESSAGES_0_FILENAME]);
    deletionPromises.push(rm(metadata_path));
    deletionPromises.push(rm(participants_path));
    deletionPromises.push(rm(messages_0_path));
    await compressFile(tar_path);
    deletionPromises.push(
        sendFile(channel, `${tar_path}.gz`, `${TAR_FILENAME}.gz`));
  }

  while (existsSync(`${channel.id}/messages_${pageNo}.json`)) {
    await compressFile(`${channel.id}/messages_${pageNo}.json`);
    deletionPromises.push(sendFile(
        channel, `${channel.id}/messages_${pageNo}.json.gz`,
        `messages_${pageNo}.json.gz`));
    ++pageNo;
  }

  return Promise.all(deletionPromises);
}

/**
 * Compresses a file using gzip and deletes the original file. Produces a .gz
 * file.
 * @param {string} filepath
 * @return {Promise} Indicates when the uncompressed file is deleted.
 * This also implies that the file was gzipped.
 */
async function compressFile(filepath) {
  const gzip = createGzip();
  const source = createReadStream(filepath);
  const destination = createWriteStream(`${filepath}.gz`);
  await pipeline(source, gzip, destination);
  return rm(filepath);
}

/**
 * Sends a file to a channel. The file is deleted after it is sent.
 * @param {TextChannel} channel
 * @param {string} filepath
 * @param {string} filename
 * @return {Promise} Indicates that the file has been deleted. This implies that
 * the file was sent.
 */
async function sendFile(channel, filepath, filename) {
  await channel.send({files: [{attachment: filepath, name: filename}]});
  return rm(filepath);
}

/**
 * Generates the message files and participants file if need be. This behaves
 * differently if called on a subchannel (thread) where, instead, no files are
 * generated and the extracted messages and participants are returned.
 * @param {TextChannel} channel
 * @param {string[]} args
 * @param {boolean} isSubchannel - Defaults to false. If false, then this will
 * generate files.
 * @return {Promise|Collection<snowflake,Object>} If inSubchannel is false then
 * the return value is a promise indicating that all files were generated. If
 * true then the returned value is a Collection of extracted messages in a
 * subchannel.
 */
async function generateMessageFiles(channel, args, inSubchannel = false) {
  let preparedMessages = new Collection();
  const participants = new Collection();
  const filePromises = [];

  // Holds a promise
  let messagesFetched;
  // The actual messages fetched
  let fetchedMessageSet = new Collection();
  let lastSnowflake = null;
  // Used in page generation
  let page = 0;

  do {
    messagesFetched = getChannelMessages(channel, lastSnowflake);

    const [messages, users] = await extractMessageData(fetchedMessageSet, args);
    if (!args.includes('participants'))
      preparedMessages = preparedMessages.concat(messages);
    // Will update the participants list with join information if any
    // since messages are from newest to oldest. Can be more efficient.
    for (const [tag, user] of users) participants.set(tag, user);

    // The assumption is that extracted batches in JSON are less than 1MB.
    // A very lax way of handling this. A more sophisticated approach can be
    // done but for our server's purpose we don't need more than this.
    if (!inSubchannel) {
      const preparedMessagesJson = JSON.stringify(preparedMessages);
      if (Buffer.byteLength(preparedMessagesJson, 'utf8') >=
          FILE_UPLOAD_SIZE_LIMIT) {
        filePromises.push(writeFile(
            `${channel.id}/messages_${page}.json`, preparedMessagesJson,
            'utf8'));
        ++page;
        fetchedMessageSet.clear();
      }
    }

    fetchedMessageSet = await messagesFetched;
    lastSnowflake = fetchedMessageSet.lastKey();
  } while (fetchedMessageSet.size === MESSAGE_FETCH_LIMIT);

  if (fetchedMessageSet.size !== 0) {
    const [messages, users] = await extractMessageData(fetchedMessageSet, args);
    if (!args.includes('participants'))
      preparedMessages = preparedMessages.concat(messages);

    for (const [tag, user] of users) participants.set(tag, user);
  }

  if (!inSubchannel) {
    const preparedMessagesJson = JSON.stringify(preparedMessages);
    if (preparedMessagesJson.length > 2)
      filePromises.push(writeFile(
          `${channel.id}/messages_${page}.json`, preparedMessagesJson, 'utf8'));
  }

  if (!inSubchannel && !args.includes('messages-only'))
    filePromises.push(writeFile(
        `${channel.id}/${PARTICIPANTS_FILENAME}`, JSON.stringify(participants),
        'utf8'));

  return (!inSubchannel) ? Promise.all(filePromises) :
                           [preparedMessages, participants];
}

/**
 * Based on args, extracts data from a message collection and builds a new
 * message object with the selected data to gather.
 * @param {Collection<snowflake,Message>} messageCollection
 * @param {string[]} args
 * @return {Collection[]} An array of
 * two values is returned. The first value is a Collection holding the snowflake
 * of the original message and the coresponding extracted message. The second is
 * a participants Collection with a tag and object with the user's data.
 */
async function extractMessageData(messageCollection, args) {
  let extractedMessages = new Collection();
  const participants = new Collection();

  for (const [snowflake, message] of messageCollection) {
    const extractedData = {
      id: message.id,
      author: message.author.tag,
      time: message.createdAt,
      text: message.content
    };

    if (message.pinned) extractedData.pinned = true;

    // Even if the message was deleted the snowflake is still there
    if (message.type === 'REPLY')
      extractedData.replyingTo = message.reference.messageId;

    // Only true if it's a message in a thread
    if (message.channel.type === 'GUILD_NEWS_THREAD' ||
        message.channel.type === 'GUILD_PUBLIC_THREAD' ||
        message.channel.type === 'GUILD_PRIVATE_THREAD')
      extractedData.threadId = message.channelId;

    if (args.includes('reactions'))
      extractedData.reactions = [await getReactions(message, participants)];

    if (args.includes('stickers'))
      extractedData.stickers = getStickers(message);

    if (args.includes('attachments'))
      extractedData.attachments = getAttachments(message);

    extractedMessages.set(message.id, extractedData);
    updateUserCollection(participants, message.author);
    if (message.type === 'GUILD_MEMBER_JOIN')
      participants.get(message.author.tag).joined = message.createdAt;

    // This will never be true for messages that are in threads
    if (args.includes('threads') && message.hasThread) {
      extractedData.spawnedThread = true;
      extractedData.threadId = message.thread.id;
      const [threadMessages, threadParticipants] =
          await generateMessageFiles(message.thread, args, true);
      extractedMessages = extractedMessages.concat(threadMessages);
      for (const [tag, participantInfo] of threadParticipants)
        participants.set(tag, participantInfo);
    }
  }

  return [extractedMessages, participants];
}

/**
 * Extracts sticker data from a message.
 * @param {Message} message
 * @return {Object[]} Returns an array of sticker data objects.
 */
function getStickers(message) {
  const stickers = [];

  for (const [snowflake, sticker] of message.stickers) {
    const stickerInfo = {
      id: sticker.id,
      name: sticker.name,
      url: sticker.url,
      creator: sticker.user.tag
    };

    stickers.push(stickerInfo);
  }

  return stickers;
}

/**
 * Extracts attachment data from a message.
 * @param {Message} message
 * @return {Object[]} Returns an array of attachment data objects.
 */
function getAttachments(message) {
  const attachments = [];

  for (const [snowflake, attachment] of message.attachments) {
    const attachmentInfo = {
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

/**
 * Extracts reaction data and updates the participant Collection, adding or
 * updating the stored user data if it finds a new field or user not present in
 * the Collection.
 * @params {Message} message
 * @params {Collection<tag,Object>} participants
 * @return {Object} Returns an object where the field is the emoji and the
 * value is an array of user tags who reacted with this emoji.
 */
async function getReactions(message, participants) {
  const reactionData = {};
  const reactions = message.reactions.cache;

  for (const [emojiString, reaction] of reactions) {
    reactionData[reaction.emoji.name] =
        await getReactors(reaction.users, participants);
  }

  return reactionData;
}

/**
 * Fetches an array of tags of users who reacted with that emoji.
 * Updates the participants list if the participant fetched is not in the
 * Collection already. Only 100 users max are captured.
 * @param {ReactionUserManager} reactionManager
 * @param {Collection<tag,Object>} participants
 * @return {Object[]} Returns an array of user tags who reacted with the emoji.
 */
async function getReactors(reactionManager, participants) {
  const userData = [];
  const users = await reactionManager.fetch();

  users.each((user) => {
    userData.push(user.tag);
    updateUserCollection(participants, user);
  });

  return userData;
}

/**
 * Updates the Collection if the user tag is not present.
 * @param {Collection<tag,Object>} participantCollection
 * @param {User} user
 */
function updateUserCollection(participantCollection, user) {
  if (!participantCollection.has(user.tag)) {
    const participant = {
      id: user.id,
      tag: user.tag,
      pfp: user.displayAvatarURL({dynamic: true})
    };

    participantCollection.set(user.tag, participant);
  }
}

/**
 * Fetches channel messages up to MESSAGE_FETCH_LIMIT. Messages fetched are from
 * newest to oldest. If snowflake is null, messages are retrieved starting from
 * the most recent in the channel.
 * @param {TextChannel} channel
 * @param {snowflake} snowflake
 * @return {Promise} Indicates when the fetch completes.
 */
function getChannelMessages(channel, snowflake = null) {
  const fetchOptions = {limit: MESSAGE_FETCH_LIMIT, before: snowflake};

  return channel.messages.fetch(fetchOptions);
}

/**
 * Checks to see if the command structure is valid without processing the
 * arguments.
 * @param {string[]} args
 * @param {TextChannel} channel
 * @return {boolean}
 */
function isValidCommand(args, channel) {
  if (!args.length) {
    channel.send(`>>> No argument provided.\n${USAGE}`);
    return false;
  }

  const recognized_args = [
    'metadata', 'participants', 'complete', 'text', 'reactions', 'stickers',
    'attachments', 'threads', 'whole-messages', 'messages-only'
  ];

  for (const arg of args) {
    if (!recognized_args.includes(arg)) {
      channel.send(`>>> Unrecognized argument: ${arg}\n${USAGE}`);
      return false;
    }
  }

  if (args.includes('metadata') || args.includes('participants') ||
      args.includes('complete')) {
    if (args.length !== 1) {
      channel.send(
          `>>> Arguments "metadata", "participants", and "complete" can't be accompanied by other arguments.\n${USAGE}`);
      return false;
    }

    return true;
  }

  if (args[0] !== 'text' && args[0] !== 'whole-messages') {
    channel.send(
        `>>> "text" or "whole-messages" must be specified before other arguments.\n${USAGE}`);
    return false;
  }

  if (args.includes('text') && args.includes('whole-messages')) {
    channel.send(
        `>>> "text" and "whole-messages" are mutually exclusive.\n${USAGE}`);
    return false;
  }

  if (args[0] === 'whole-messages' && args.length >= 2) {
    if (args.length > 2) {
      channel.send(
          `>>> "whole-messages" can't have more than 1 argument.\n${USAGE}`);
      return false;
    }

    if (args[1] !== 'messages-only') {
      channel.send(
          `>>> "messages-only" is the only argument that can come after "whole-messages".\n${USAGE}`);
      return false;
    }
  }

  return true;
}
