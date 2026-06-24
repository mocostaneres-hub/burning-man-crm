export const NO_RESTRICTIONS_FOOD_PREFERENCE = 'No Restrictions';

export const FOOD_PREFERENCE_OPTIONS = [
  'Vegan',
  'Vegetarian',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  NO_RESTRICTIONS_FOOD_PREFERENCE
] as const;

export type FoodPreference = typeof FOOD_PREFERENCE_OPTIONS[number];

export const normalizeFoodPreferences = (value: unknown): FoodPreference[] => {
  if (!Array.isArray(value)) return [];

  const selected = new Set(
    value.filter((item): item is FoodPreference =>
      typeof item === 'string' && FOOD_PREFERENCE_OPTIONS.includes(item as FoodPreference)
    )
  );

  if (selected.has(NO_RESTRICTIONS_FOOD_PREFERENCE)) {
    return [NO_RESTRICTIONS_FOOD_PREFERENCE];
  }

  return FOOD_PREFERENCE_OPTIONS.filter(
    (option) => option !== NO_RESTRICTIONS_FOOD_PREFERENCE && selected.has(option)
  );
};

export const toggleFoodPreference = (current: unknown, preference: FoodPreference): FoodPreference[] => {
  const normalized = normalizeFoodPreferences(current);

  if (preference === NO_RESTRICTIONS_FOOD_PREFERENCE) {
    return normalized.includes(NO_RESTRICTIONS_FOOD_PREFERENCE)
      ? []
      : [NO_RESTRICTIONS_FOOD_PREFERENCE];
  }

  const withoutNoRestrictions = normalized.filter((item) => item !== NO_RESTRICTIONS_FOOD_PREFERENCE);
  if (withoutNoRestrictions.includes(preference)) {
    return withoutNoRestrictions.filter((item) => item !== preference);
  }

  return normalizeFoodPreferences([...withoutNoRestrictions, preference]);
};

export const getFoodPreferenceTagClass = (preference: string): string => {
  switch (preference) {
    case 'Vegan':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Vegetarian':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Gluten-Free':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Dairy-Free':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'Nut-Free':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case NO_RESTRICTIONS_FOOD_PREFERENCE:
      return 'bg-gray-100 text-gray-700 border-gray-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};
