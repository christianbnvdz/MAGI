// Command types must be set to the name of the directory
// that contains them. Ex: Admin commands are held in admin
// so the type is set to admin
/**
 * @module util/command
 */

/**
 * The ADMIN, CHAT, or MISC command type
 * @typedef {CommandType.ADMIN|CommandType.CHAT|CommandType.MISC} CommandType
 */
const CommandType = {
  ADMIN: 'admin',
  CHAT: 'chat',
  MISC: 'misc'
};

export {CommandType};
