export const PHONE_COUNTRY_CODE_OPTIONS = [
  { value: '+1', label: 'US/Canada (+1)' },
  { value: '+31', label: 'Netherlands (+31)' },
  { value: '+44', label: 'United Kingdom (+44)' },
  { value: '+49', label: 'Germany (+49)' },
  { value: '+33', label: 'France (+33)' },
  { value: '+34', label: 'Spain (+34)' },
  { value: '+39', label: 'Italy (+39)' },
  { value: '+52', label: 'Mexico (+52)' },
  { value: '+55', label: 'Brazil (+55)' },
  { value: '+61', label: 'Australia (+61)' },
  { value: '+972', label: 'Israel (+972)' },
  { value: '+81', label: 'Japan (+81)' }
];

export const normalizePhoneCountryCode = (value?: string | null): string => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
};

export const guessPhoneCountryCodeFromNumber = (phoneNumber?: string | null): string => {
  const rawPhone = String(phoneNumber || '').trim();
  if (!rawPhone.startsWith('+')) return '';

  const phoneDigits = getPhoneDigits(rawPhone);
  const matchingOption = [...PHONE_COUNTRY_CODE_OPTIONS]
    .sort((a, b) => getPhoneDigits(b.value).length - getPhoneDigits(a.value).length)
    .find((option) => phoneDigits.startsWith(getPhoneDigits(option.value)));

  return matchingOption?.value || '';
};

export const isValidPhoneCountryCode = (value?: string | null): boolean =>
  /^\+\d{1,4}$/.test(normalizePhoneCountryCode(value));

export const getPhoneDigits = (value?: string | null): string =>
  String(value || '').replace(/\D/g, '');

export const formatPhoneForDisplay = (
  phoneNumber?: string | null,
  phoneCountryCode?: string | null
): string => {
  const rawPhone = String(phoneNumber || '').trim();
  if (!rawPhone) return '';
  if (rawPhone.startsWith('+')) return rawPhone;

  const normalizedCountryCode = normalizePhoneCountryCode(phoneCountryCode);
  return [normalizedCountryCode, rawPhone].filter(Boolean).join(' ');
};

export const normalizePhoneNumberForMessaging = (
  phoneNumber?: string | null,
  phoneCountryCode?: string | null
): string => {
  const rawPhone = String(phoneNumber || '').trim();
  const phoneDigits = getPhoneDigits(rawPhone);
  if (!phoneDigits) return '';

  if (rawPhone.startsWith('+')) return phoneDigits;

  const countryDigits = getPhoneDigits(phoneCountryCode);
  if (!countryDigits) return phoneDigits;

  return phoneDigits.startsWith(countryDigits)
    ? phoneDigits
    : `${countryDigits}${phoneDigits}`;
};

export const buildSmsLink = (
  phoneNumber?: string | null,
  phoneCountryCode?: string | null
): string => {
  const messagingNumber = normalizePhoneNumberForMessaging(phoneNumber, phoneCountryCode);
  return messagingNumber ? `sms:+${messagingNumber}` : '';
};

export const buildWhatsAppLink = (
  phoneNumber?: string | null,
  phoneCountryCode?: string | null
): string => {
  const messagingNumber = normalizePhoneNumberForMessaging(phoneNumber, phoneCountryCode);
  return messagingNumber ? `https://wa.me/${messagingNumber}` : '';
};
