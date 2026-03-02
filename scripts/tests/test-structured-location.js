const assert = require('assert');
const {
  hasStructuredLocationFields,
  normalizeStructuredLocation,
  validateStructuredLocation
} = require('../../server/utils/structuredLocation');

(() => {
  assert.strictEqual(hasStructuredLocationFields(null), false);
  assert.strictEqual(hasStructuredLocationFields({ city: 'Reno' }), true);

  const normalized = normalizeStructuredLocation({
    city: '  Reno ',
    state: ' NV ',
    country: ' United States ',
    countryCode: ' us ',
    lat: '39.5296',
    lng: '-119.8138'
  });

  assert.strictEqual(normalized.city, 'Reno');
  assert.strictEqual(normalized.state, 'NV');
  assert.strictEqual(normalized.country, 'United States');
  assert.strictEqual(normalized.countryCode, 'US');
  assert.strictEqual(normalized.lat, 39.5296);
  assert.strictEqual(normalized.lng, -119.8138);

  const validResult = validateStructuredLocation(normalized);
  assert.strictEqual(validResult.valid, true);

  const invalidResult = validateStructuredLocation({ city: 'Reno' });
  assert.strictEqual(invalidResult.valid, false);

  console.log('✅ Structured location tests passed');
})();
