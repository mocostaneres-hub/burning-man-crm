const normalizePhoneCountryCode = (value) => {
  if (value === null || value === undefined) return '';
  const digits = String(value).replace(/\D/g, '');
  return digits ? `+${digits}` : '';
};

const isValidPhoneCountryCode = (value) => /^\+\d{1,4}$/.test(normalizePhoneCountryCode(value));

const getPhoneDigits = (value) => String(value || '').replace(/\D/g, '');

const isValidProfilePhoneNumber = (value) => {
  const digitCount = getPhoneDigits(value).length;
  return digitCount >= 7 && digitCount <= 20;
};

const normalizePhoneNumberForMessaging = (phoneNumber, phoneCountryCode) => {
  const rawPhone = String(phoneNumber || '').trim();
  const phoneDigits = getPhoneDigits(rawPhone);
  if (!phoneDigits) return '';

  if (rawPhone.startsWith('+')) {
    return phoneDigits;
  }

  const countryDigits = getPhoneDigits(phoneCountryCode);
  if (!countryDigits) return phoneDigits;

  return phoneDigits.startsWith(countryDigits)
    ? phoneDigits
    : `${countryDigits}${phoneDigits}`;
};

const formatPhoneForDisplay = (phoneNumber, phoneCountryCode) => {
  const rawPhone = String(phoneNumber || '').trim();
  if (!rawPhone) return '';
  if (rawPhone.startsWith('+')) return rawPhone;

  const normalizedCountryCode = normalizePhoneCountryCode(phoneCountryCode);
  return [normalizedCountryCode, rawPhone].filter(Boolean).join(' ');
};

module.exports = {
  normalizePhoneCountryCode,
  isValidPhoneCountryCode,
  isValidProfilePhoneNumber,
  normalizePhoneNumberForMessaging,
  formatPhoneForDisplay
};
