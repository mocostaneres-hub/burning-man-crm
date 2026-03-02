const LOCATION_REQUIRED_FIELDS = ['city', 'country', 'countryCode', 'lat', 'lng'];

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const toNumberOrUndefined = (value) => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const hasStructuredLocationFields = (location) => {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return false;
  }
  return [
    location.city,
    location.state,
    location.country,
    location.countryCode,
    location.lat,
    location.lng,
    location.placeId
  ].some((value) => value !== undefined && value !== null && `${value}`.trim() !== '');
};

const normalizeStructuredLocation = (location) => {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return null;
  }

  const normalized = {
    city: isNonEmptyString(location.city) ? location.city.trim() : '',
    state: isNonEmptyString(location.state) ? location.state.trim() : undefined,
    country: isNonEmptyString(location.country) ? location.country.trim() : '',
    countryCode: isNonEmptyString(location.countryCode) ? location.countryCode.trim().toUpperCase() : '',
    lat: toNumberOrUndefined(location.lat),
    lng: toNumberOrUndefined(location.lng),
    placeId: isNonEmptyString(location.placeId) ? location.placeId.trim() : undefined
  };

  if (!normalized.state) delete normalized.state;
  if (!normalized.placeId) delete normalized.placeId;

  return normalized;
};

const validateStructuredLocation = (location) => {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return {
      valid: false,
      message: 'Location must be an object.'
    };
  }

  const normalized = normalizeStructuredLocation(location);
  for (const field of LOCATION_REQUIRED_FIELDS) {
    if (
      normalized[field] === undefined ||
      normalized[field] === null ||
      (typeof normalized[field] === 'string' && normalized[field].length === 0)
    ) {
      return {
        valid: false,
        message: `Location.${field} is required when selecting a city.`
      };
    }
  }

  if (!Number.isFinite(normalized.lat) || !Number.isFinite(normalized.lng)) {
    return {
      valid: false,
      message: 'Location.lat and location.lng must be valid numbers.'
    };
  }

  return {
    valid: true,
    normalized
  };
};

module.exports = {
  hasStructuredLocationFields,
  normalizeStructuredLocation,
  validateStructuredLocation
};
