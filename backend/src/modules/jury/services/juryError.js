/**
 * An expected failure. `code` lets the screens react without parsing Turkish messages.
 * @param {number} status @param {string} message @param {string} [code]
 */
const juryError = (status, message, code) => Object.assign(new Error(message), { status, juryCode: code });

module.exports = { juryError };
