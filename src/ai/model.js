const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const botConfig = require('../config/botConfig');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function generateResponse(message) {
  try {
    logger.info('Starting Claude request');

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key is not configured');
    }

    // Determine if this message contains an image
    const hasImage = Array.isArray(message) && message.some(m => m.type === 'image_url');

    // Choose model — use full model for images, same model for text
    const modelToUse = hasImage
      ? botConfig.ai.model.imageName
      : botConfig.ai.model.name;

    // Convert message format from OpenAI style to Claude style
    // Claude uses { type: "text", text: "..." } and { type: "image", source: { type: "base64", ... } }
    let claudeContent;

    if (Array.isArray(message)) {
      claudeContent = message.map(part => {
        // Text part
        if (part.type === 'text') {
          return { type: 'text', text: part.text };
        }

        // Image part — convert from OpenAI image_url format to Claude base64 format
        if (part.type === 'image_url') {
          const imageUrl = part.image_url?.url || '';

          // If it's a base64 data URL (which our imageService produces)
          if (imageUrl.startsWith('data:')) {
            const matches = imageUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
            if (matches) {
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: matches[1],  // e.g. "image/jpeg"
                  data: matches[2]         // the raw base64 string
                }
              };
            }
          }

          // If it's a regular URL (fallback)
          return {
            type: 'image',
            source: {
              type: 'url',
              url: imageUrl
            }
          };
        }

        // Fallback — pass through as text
        return { type: 'text', text: JSON.stringify(part) };
      });
    } else {
      // Plain string message
      claudeContent = [{ type: 'text', text: String(message) }];
    }

    logger.info(`Sending request to Claude model: ${modelToUse}`);

    const response = await anthropic.messages.create({
      model: modelToUse,
      max_tokens: botConfig.ai.model.maxTokens,
      system: botConfig.ai.model.systemPrompt,
      messages: [
        {
          role: 'user',
          content: claudeContent
        }
      ]
    });

    if (!response.content || !response.content[0]) {
      logger.error('Invalid response structure from Claude:', JSON.stringify(response));
      throw new Error('Invalid response from Claude');
    }

    logger.info('Successfully received Claude response');
    return response.content[0].text;

  } catch (error) {
    logger.error('Error in Claude request:', error);
    logger.error('Error details:', error.message);
    throw error;
  }
}

module.exports = { generateResponse };
