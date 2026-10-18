const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const logger = require('../utils/logger');
const botConfig = require('../config/botConfig');
const stripe = require('../config/stripe');

// Debug endpoint for checking customer information
router.get('/debug/:phoneNumber', async (req, res) => {
  try {
    const phoneNumber = req.params.phoneNumber;
    logger.info(`Debugging customer with phone number: ${phoneNumber}`);
    
    await paymentService.debugStripeCustomer(phoneNumber);
    
    // Also check subscription directly
    const isSubscribed = await paymentService.checkStripeSubscription(phoneNumber);
    
    res.json({
      success: true,
      message: 'Debug information logged',
      isSubscribed
    });
  } catch (error) {
    logger.error(`Error debugging customer: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Stripe webhook endpoint for handling events
 * This route is designed to be optional - if not configured, it won't affect the rest of the system
 */
router.post('/webhook/stripe', async (req, res) => {
  try {
    // Check if webhook handling is enabled
    if (!botConfig.stripe.webhooks.removeBillingAddress.enabled) {
      logger.info('Stripe webhook handling is disabled, but endpoint is accessible');
      // Still return 200 to acknowledge the webhook
      return res.status(200).send('Webhook received but feature is disabled');
    }
    
    const sig = req.headers['stripe-signature'];
    const webhookSecret = botConfig.stripe.webhooks.removeBillingAddress.secret;
    
    // If no webhook secret is configured, log a warning but still process the webhook
    if (!webhookSecret) {
      logger.warn('Stripe webhook secret is not configured, webhook signature verification will be skipped');
    }
    
    let event;
    
    // Verify webhook signature if secret is provided
    if (sig && webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        logger.info('Stripe webhook signature verified successfully');
      } catch (err) {
        logger.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      // If no signature verification, just parse the payload
      try {
        // If body is already parsed as JSON, use it directly
        if (typeof req.body === 'object' && req.body !== null) {
          event = req.body;
        } else {
          // Otherwise parse raw body
          event = JSON.parse(req.body.toString());
        }
        logger.info('Processed webhook without signature verification');
      } catch (err) {
        logger.error(`Error parsing webhook payload: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    }
    
    // Handle the webhook event
    const result = await paymentService.handleStripeWebhook(event);
    logger.info(`Webhook handling result: ${JSON.stringify(result)}`);
    
    // Return a success response
    res.status(200).json({ received: true, ...result });
  } catch (error) {
    logger.error(`Error processing webhook: ${error.message}`);
    logger.error(error.stack);
    res.status(500).send(`Webhook Error: ${error.message}`);
  }
});

module.exports = router; 