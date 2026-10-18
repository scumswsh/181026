const axios = require('axios');
const logger = require('../utils/logger');
const botConfig = require('../config/botConfig');

const sentMessages = new Map();
const MESSAGE_EXPIRY = botConfig.whatsapp.messageExpiry;

setInterval(() => {
  const now = Date.now();
  for (const [id, timestamp] of sentMessages) {
    if (now - timestamp > MESSAGE_EXPIRY) {
      sentMessages.delete(id);
    }
  }
}, 60000);

const whatsapp = {
  sendText: async (to, text) => {
    try {
      const messageId = `${to}-${Date.now()}`;
      
      if (sentMessages.has(messageId)) {
        logger.info(`Skipping duplicate outgoing message: ${messageId}`);
        return null;
      }

      const response = await axios.post(
        `${botConfig.whatsapp.endpoints.mediaUrl}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: { body: text }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      sentMessages.set(messageId, Date.now());
      logger.info(`Message sent successfully to ${to}`);

      return {
        status: 'success',
        messageId: response.data?.messages?.[0]?.id,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      logger.error('Error details:', error.response?.data || error.message);
      return {
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
};

module.exports = whatsapp;
