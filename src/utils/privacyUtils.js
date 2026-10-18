const logger = require('./logger');
const botConfig = require('../config/botConfig');

/**
 * Checks if user is new and sends privacy welcome message if needed
 * @param {string} userId - The user's ID
 * @param {Object} dependencies - Required service dependencies
 * @returns {Promise<Object|void>} - Returns status object if welcome message sent, void otherwise
 */
async function sendPrivacyMessageIfNewUser(userId, dependencies) {
  const { databaseService, whatsappService } = dependencies;
  
  try {
    // First, check if the user exists in the database and if welcome was sent
    const user = await databaseService.findOrCreateUser(userId);
    
    // Log the user details for debugging
    logger.info(`User check for privacy message: userId=${userId}, welcomeSent=${user.welcome_sent}`);
    
    // Only send welcome message if welcome_sent is false and welcome messages are enabled
    if (user.welcome_sent === false && botConfig.welcome.enabled) {
      // Log the action
      logger.info(`Sending welcome message to first-time user: ${userId}`);
      
      // Send the privacy/welcome message
      const result = await whatsappService.sendText(userId, botConfig.welcome.message);
      
      // Mark welcome message as sent
      await databaseService.markWelcomeSent(userId);
      logger.info(`Marked welcome message as sent for user: ${userId}`);
      
      // Add welcome message to message history
      try {
        await databaseService.saveMessage(userId, "[WELCOME_MESSAGE]", botConfig.welcome.message);
        logger.info(`Saved welcome message to conversation history for user: ${userId}`);
      } catch (saveError) {
        logger.error(`Failed to save welcome message to history: ${saveError.message}`);
      }
      
      return { status: 'success', type: 'welcome_message_sent', messageId: result?.messageId };
    }
    
    // Log if we're not sending a welcome message
    if (user.welcome_sent !== false) {
      logger.info(`User ${userId} has already received welcome message, skipping`);
    } else if (!botConfig.welcome.enabled) {
      logger.info(`Welcome messages are disabled in bot config, skipping for user ${userId}`);
    }
    
    // If not a new user, return nothing
    return;
  } catch (error) {
    logger.error(`Error in sendPrivacyMessageIfNewUser: ${error.message}`);
    logger.error(error.stack);
    return { status: 'error', message: error.message };
  }
}

module.exports = {
  sendPrivacyMessageIfNewUser
}; 