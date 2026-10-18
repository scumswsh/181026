const axios = require('axios');
const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const botConfig = require('../config/botConfig');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Ensure temp directory exists
const tempDir = path.join(__dirname, '..', '..', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function transcribeAudio(mediaId) {
  let tempFilePath = null;
  try {
    logger.info('Starting audio transcription process');
    const audioBuffer = await downloadAudioFromWhatsApp(mediaId);
    logger.info('Audio downloaded successfully');

    tempFilePath = path.join(tempDir, `${mediaId}.ogg`);
    fs.writeFileSync(tempFilePath, audioBuffer);
    logger.info('Audio file saved to temp directory');

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: botConfig.ai.model.audioTranscriptionModel || "whisper-1",
    });
    logger.info('Audio transcription completed');

    return transcription.text;
  } catch (error) {
    logger.error(`Error transcribing audio: ${error.message}`);
    logger.error(error.stack);
    throw new Error(botConfig.ai.prompts.audio.transcriptionError);
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        logger.info('Temp file cleaned up');
      } catch (cleanupError) {
        logger.error(`Error cleaning up temp file: ${cleanupError.message}`);
      }
    }
  }
}

async function downloadAudioFromWhatsApp(mediaId) {
  try {
    logger.info('Getting media URL');
    const mediaUrl = await getMediaUrl(mediaId);
    logger.info('Downloading audio from URL');
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
      }
    });
    logger.info('Audio download completed');
    return Buffer.from(response.data);
  } catch (error) {
    logger.error(`Error downloading audio from WhatsApp: ${error.message}`);
    logger.error(error.stack);
    throw error;
  }
}

async function getMediaUrl(mediaId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v20.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
        }
      }
    );
    return response.data.url;
  } catch (error) {
    logger.error(`Error getting media URL: ${error.message}`);
    logger.error(error.stack);
    throw error;
  }
}

module.exports = { transcribeAudio };
