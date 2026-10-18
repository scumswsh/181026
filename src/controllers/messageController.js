// =============================================================================
// IMPERAUX — messageController.js
// Orchestrates all incoming WhatsApp messages.
// Handles routing, user lookup, message prep, and queue handoff.
// =============================================================================

const whatsapp = require('../services/whatsappService');
const { generateResponse } = require('../ai/model');
const databaseService = require('../services/databaseService');
const paymentService = require('../services/paymentService');
const logger = require('../utils/logger');
const { isBlockedCountry } = require('../utils/countryBlocker');
const { transcribeAudio } = require('../services/transcriptionService');
const { downloadImageFromWhatsApp } = require('../services/imageService');
const { handleMessage: queueHandler } = require('../services/queueService');
const botConfig = require('../config/botConfig');
const { sendPrivacyMessageIfNewUser } = require('../utils/privacyUtils');

async function handleMessage(req) {
  let from = null;

  try {
    logger.info('Processing incoming message:', JSON.stringify(req.body));

    // -------------------------------------------------------------------------
    // Step 1: Extract message from WhatsApp webhook payload
    // -------------------------------------------------------------------------
    const data = req.body;
    if (!data.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      logger.info('No message in webhook payload');
      return;
    }

    const message = data.entry[0].changes[0].value.messages[0];
    from = message.from;

    logger.info(`Received message from ${from} of type ${message.type}`);

    // -------------------------------------------------------------------------
    // Step 2: Block restricted countries
    // -------------------------------------------------------------------------
    if (isBlockedCountry(from)) {
      logger.info(`Blocked message from country code in: ${from}`);
      await whatsapp.sendText(from, botConfig.access.blockedCountries.message);
      return;
    }

    // -------------------------------------------------------------------------
    // Step 3: New user check — send welcome message and return early
    // The welcome message is sent once on first contact.
    // We return early so the first real message is processed on next send.
    // -------------------------------------------------------------------------
    const dependencies = {
      databaseService,
      whatsappService: whatsapp,
    };

    try {
      const privacyResult = await sendPrivacyMessageIfNewUser(from, dependencies);
      if (privacyResult && privacyResult.status === 'success') {
        logger.info(`Welcome message sent to new user: ${from}`);
        return privacyResult;
      }
    } catch (error) {
      logger.error(`Error in new user welcome check: ${error.message}`);
      // Non-fatal — continue processing the message
    }

    // -------------------------------------------------------------------------
    // Step 4: Load user from database
    // This gives us tier and vertical for building the dynamic system prompt.
    // user.tier     — 'paid' | 'premium' | null (null = trial)
    // user.vertical — 'logistics' | 'retail' | null
    // -------------------------------------------------------------------------
    let user = null;
    try {
      user = await databaseService.findOrCreateUser(from);
      logger.info(`User loaded: ${from} | tier: ${user?.tier || 'trial'} | vertical: ${user?.vertical || 'none'}`);
    } catch (error) {
      logger.error(`Failed to load user ${from}: ${error.message}`);
      // Non-fatal — continue with null user, buildSystemPrompt handles nulls safely
    }

    // -------------------------------------------------------------------------
    // Step 5: Build the dynamic system prompt
    // Assembles base prompt + vertical overlay (premium only) + tier overlay.
    // botConfig.buildSystemPrompt() is defined in botConfig.js.
    // Safe with null values — defaults to paid behaviour with no vertical.
    // -------------------------------------------------------------------------
    const systemPrompt = botConfig.buildSystemPrompt(
      user?.vertical || null,
      user?.tier || null
    );

    logger.info(`System prompt built for ${from} | tier: ${user?.tier || 'trial'} | vertical: ${user?.vertical || 'none'}`);

    // -------------------------------------------------------------------------
    // Step 6: Prepare message content based on type
    // messageContent  — human-readable string (saved to DB, used for logging)
    // messageForAI    — array of content blocks sent to Claude
    // -------------------------------------------------------------------------
    let messageContent = '';
    let messageForAI = [];
    const messageType = message.type;

    if (messageType === 'text') {
      // Plain text message — pass directly to Claude
      messageContent = message.text.body;
      messageForAI = [{ type: 'text', text: messageContent }];
      logger.info(`Text message prepared: ${messageContent}`);

    } else if (messageType === 'audio') {
      // Voice note — transcribe via Whisper, then treat as text
      const mediaId = message.audio.id;
      logger.info(`Transcribing audio with media ID: ${mediaId}`);
      messageContent = await transcribeAudio(mediaId);
      messageForAI = [{ type: 'text', text: messageContent }];
      logger.info(`Audio transcribed: ${messageContent}`);

    } else if (messageType === 'image') {
      // Image — download, build extraction prompt, send to Claude vision
      const imageUrl = await downloadImageFromWhatsApp(message.image.id);
      const caption = message.image.caption || '';
      messageContent = caption ? `Image with caption: ${caption}` : 'Image sent by user';

      // Select the right image prompt based on whether a caption was provided
      const imagePrompt = caption
        ? botConfig.ai.prompts.image.withCaption(caption)
        : botConfig.ai.prompts.image.withoutCaption;

      messageForAI = [
        { type: 'text', text: imagePrompt },
        { type: 'image_url', image_url: { url: imageUrl } }
      ];
      logger.info(`Image message prepared with caption: "${caption}"`);

    } else {
      // Unsupported type — inform user and exit
      logger.info(`Unsupported message type received: ${messageType}`);
      await whatsapp.sendText(from, botConfig.errors.unsupportedType);
      return;
    }

    // -------------------------------------------------------------------------
    // Step 7: Hand off to queue service
    // The queue service handles: subscription check → message count → context
    // → AI call → send response → save to DB.
    //
    // We pass systemPrompt here so the queue service can forward it to
    // generateResponse(). Update queueService.js to accept and use systemPrompt
    // from the handlers object — see note below.
    // -------------------------------------------------------------------------
    const handlers = {
      checkSubscription: paymentService.checkStripeSubscription,
      findOrCreateUser: databaseService.findOrCreateUser,
      updateSubscription: databaseService.updateSubscription,
      incrementMessageCount: databaseService.incrementMessageCount,
      getConversationContext: databaseService.getConversationContext,
      generateAIResponse: generateResponse,
      sendWhatsAppMessage: whatsapp.sendText,
      saveMessage: databaseService.saveMessage,

      // -----------------------------------------------------------------------
      // NEW: Pass the dynamic system prompt to the queue service.
      // In queueService.js, when you call generateAIResponse, change it to:
      //   await handlers.generateAIResponse(messages, context, handlers.systemPrompt)
      // This replaces any hardcoded system prompt in model.js or queueService.js.
      // -----------------------------------------------------------------------
      systemPrompt
    };

    logger.info(`Handing off to queue service for ${from} | type: ${messageType}`);

    const result = await queueHandler({
      message: { messageContent, messageForAI },
      from,
      messageType,
      handlers
    });

    logger.info(`Message processed — status: ${result?.status}`);
    return result;

  } catch (error) {
    logger.error(`Unhandled error in handleMessage: ${error.message}`);
    logger.error(error.stack);

    // Last resort: try to send a generic error to the user
    if (from) {
      try {
        await databaseService.findOrCreateUser(from);
      } catch (dbError) {
        logger.error(`Failed to ensure user exists after error: ${dbError.message}`);
      }

      try {
        await whatsapp.sendText(from, botConfig.errors.general);
      } catch (sendError) {
        logger.error(`Failed to send error message to ${from}: ${sendError.message}`);
      }
    }
  }
}

module.exports = { handleMessage };
