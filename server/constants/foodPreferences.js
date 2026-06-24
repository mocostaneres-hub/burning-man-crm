const NO_RESTRICTIONS_FOOD_PREFERENCE = 'No Restrictions';

const FOOD_PREFERENCE_OPTIONS = [
  'Vegan',
  'Vegetarian',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  NO_RESTRICTIONS_FOOD_PREFERENCE
];

const normalizeFoodPreferences = (value) => {
  if (!Array.isArray(value)) return [];

  const selected = new Set(
    value.filter((item) => typeof item === 'string' && FOOD_PREFERENCE_OPTIONS.includes(item))
  );

  if (selected.has(NO_RESTRICTIONS_FOOD_PREFERENCE)) {
    return [NO_RESTRICTIONS_FOOD_PREFERENCE];
  }

  return FOOD_PREFERENCE_OPTIONS.filter(
    (option) => option !== NO_RESTRICTIONS_FOOD_PREFERENCE && selected.has(option)
  );
};

const hasInvalidFoodPreference = (value) => (
  !Array.isArray(value) ||
  value.some((item) => typeof item !== 'string' || !FOOD_PREFERENCE_OPTIONS.includes(item))
);

module.exports = {
  FOOD_PREFERENCE_OPTIONS,
  NO_RESTRICTIONS_FOOD_PREFERENCE,
  normalizeFoodPreferences,
  hasInvalidFoodPreference
};
