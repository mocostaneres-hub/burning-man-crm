const mongoose = require('mongoose');

const slugifyCampIdentifier = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const canLookupById = (identifier) => {
  if (!identifier || typeof identifier !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(identifier) || /^\d+$/.test(identifier);
};

const findCampByIdentifier = async (db, rawIdentifier) => {
  const identifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim() : '';
  if (!identifier) return null;

  const normalizedSlug = slugifyCampIdentifier(identifier);
  const candidates = Array.from(new Set([
    identifier,
    identifier.toLowerCase(),
    normalizedSlug
  ].filter(Boolean)));

  for (const candidate of candidates) {
    const camp = await db.findCamp({ slug: candidate });
    if (camp) return camp;
  }

  for (const candidate of candidates) {
    const camp = await db.findCamp({ urlSlug: candidate });
    if (camp) return camp;
  }

  if (canLookupById(identifier)) {
    const camp = await db.findCamp({ _id: identifier });
    if (camp) return camp;
  }

  // Legacy camps can predate stored slugs. Fall back to comparing the
  // requested slug against the generated slug for each camp name.
  const camps = await db.findCamps({});
  return (camps || []).find((camp) => {
    const name = camp.name || camp.campName || '';
    return slugifyCampIdentifier(name) === normalizedSlug;
  }) || null;
};

const getCampPublicIdentifier = (camp) => (
  camp?.slug ||
  camp?.urlSlug ||
  slugifyCampIdentifier(camp?.name || camp?.campName || '') ||
  camp?._id?.toString?.() ||
  camp?._id
);

module.exports = {
  slugifyCampIdentifier,
  findCampByIdentifier,
  getCampPublicIdentifier,
  canLookupById
};
