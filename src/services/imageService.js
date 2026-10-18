const axios = require('axios');
const logger = require('../utils/logger');

async function downloadImageFromWhatsApp(mediaId) {
  try {
    const mediaUrl = await getMediaUrl(mediaId);
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
      }
    });
    const imageBuffer = Buffer.from(response.data);
    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  } catch (error) {
    logger.error(`Error downloading image from WhatsApp: ${error.message}`);
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
    throw error;
  }
}

module.exports = { downloadImageFromWhatsApp }; 