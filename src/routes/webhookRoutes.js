const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const logger = require('../utils/logger');

logger.info('Webhook routes loaded');

// WhatsApp webhook verification route
router.get('/whatsapp', (req, res) => {
  logger.info('WhatsApp GET route hit');
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info(`Mode: ${mode}, Token: ${token}, Challenge: ${challenge}`);

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      logger.info('WhatsApp webhook verified');
      res.status(200).send(challenge);
    } else {
      logger.info('WhatsApp webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    logger.info('Invalid WhatsApp webhook request');
    res.sendStatus(400);
  }
});

// New POST route for handling incoming WhatsApp messages
router.post('/whatsapp', express.json(), async (req, res) => {
  // Send 200 OK immediately to acknowledge receipt
  res.sendStatus(200);
  
  logger.info('Received WhatsApp POST request');
  logger.info(`Request headers: ${JSON.stringify(req.headers)}`);
  logger.info(`Request body: ${JSON.stringify(req.body, null, 2)}`);
  
  // Start processing in a separate "thread" so we don't block the response
  (async () => {
    try {
      // Check if the request contains a valid WhatsApp message
      const data = req.body;
      if (!data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        logger.info('No valid WhatsApp message in the request');
        return;
      }
      
      const message = data.entry[0].changes[0].value.messages[0];
      const from = message.from;
      logger.info(`Processing WhatsApp message from ${from} of type ${message.type}`);
      
      // Handle the message
      await messageController.handleMessage(req);
      logger.info(`Finished processing message from ${from}`);
    } catch (error) {
      logger.error('Error in WhatsApp webhook handler:', error);
      logger.error(error.stack);
    }
  })();
});

module.exports = router;