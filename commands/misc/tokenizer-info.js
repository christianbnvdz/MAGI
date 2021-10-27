/**
 * @module commands/misc/tokenizer-info
 */
import process from 'process';
import {MessageEmbed} from 'discord.js';

const NAME = 'tokenizer-info';
const USAGE = `Usage: ${process.env.PREFIX}${NAME}`;
const DESCRIPTION = 'Provides information about how arguments are tokenized.';
/**
 * Posts information about the tokenizer.
 * @param {Message} message - The Message that triggered this command.
 * @param {string[]} args - The arguments passed to the command.
 */
function execute(message, args) {
  sendTokenizerInfo(message);
}

export {NAME, USAGE, DESCRIPTION, execute};

/**
 * Sends a message embed with all the tokenizer information.
 * @param {Message} message
 */
async function sendTokenizerInfo(message) {
  const guild = await message.client.guilds.fetch(message.guildId);
  const guildClient = guild.me;
  const clientIcon = guildClient.user.displayAvatarURL({dynamic: true});
  const embed = new MessageEmbed()
      .setColor('#385028')
      .setAuthor(guildClient.displayName, clientIcon)
      .setTitle(`${guildClient.displayName}'s Tokenizer`)
      .setThumbnail(clientIcon)
      .setDescription(`For a command to be detected it must directly follow a "${process.env.PREFIX}" with no whitespace separation. If arguments are given then there has to be one space following the command name. Any amount of whitespace can follow. Whitespace separates each argument after the command except when double quotes are used. Double quotes are used to preserve whitespace in an argument as everything within a pair of double quotes is considered one argument. To use double quotes within an argument you can escape it with a backslash ("\\\\") and you can escape a backslash with another backslash.\n\nThere are a few rules to how you can use double quotes:\n\n1) An opening, unescaped double quote must be preceeded by whitespace.\n2) A closing, unescaped double quote must be followed by whitespace.\n3) If an unescaped double quote is used, it must be closed by another unescaped double quote.\n4) A backslash must be followed by a " or \\\\.\n\nIf there are no non-whitespace characters in double quotes then that argument is ignored.`);

  message.channel.send({embeds: [embed]});
}
