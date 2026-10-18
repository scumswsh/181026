const botConfig = require('../config/botConfig');

const blockedCountryCodes = new Set(
  (process.env.BLOCKED_COUNTRY_CODES || botConfig.access.blockedCountries.codes.join(','))
    .split(',')
    .map(code => code.trim())
);

function isBlockedCountry(phoneNumber) {
  const countryCode = phoneNumber.substring(0, phoneNumber.length - 10);
  return blockedCountryCodes.has(countryCode);
}

module.exports = {
  isBlockedCountry,
  BLOCKED_MESSAGE: botConfig.access.blockedCountries.message
};
