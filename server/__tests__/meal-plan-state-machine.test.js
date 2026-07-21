const {
  DUES_STATUS,
  MEAL_PLAN_STATUS,
  normalizeMealPlanStatus,
  isAllowedMealPlanTransition,
  getMealPlanEmailTrigger
} = require('../utils/duesStateMachine');
const Roster = require('../models/Roster');

describe('meal plan status state machine', () => {
  test('keeps opted out exclusive to meal plans', () => {
    expect(Object.values(MEAL_PLAN_STATUS)).toContain('OPTED_OUT');
    expect(Object.values(DUES_STATUS)).not.toContain('OPTED_OUT');

    const rosterMemberSchema = Roster.schema.path('members').schema;
    expect(rosterMemberSchema.path('mealPlanStatus').enumValues).toContain('OPTED_OUT');
    expect(rosterMemberSchema.path('duesStatus').enumValues).not.toContain('OPTED_OUT');
  });

  test('normalizes human-readable opted-out values', () => {
    expect(normalizeMealPlanStatus('Opted out')).toBe('OPTED_OUT');
    expect(normalizeMealPlanStatus('opted-out')).toBe('OPTED_OUT');
  });

  test.each(['UNPAID', 'INSTRUCTED', 'PAID'])(
    'allows %s members to opt out without triggering email',
    (previousStatus) => {
      expect(isAllowedMealPlanTransition(previousStatus, 'OPTED_OUT')).toBe(true);
      expect(getMealPlanEmailTrigger(previousStatus, 'OPTED_OUT')).toBeNull();
    }
  );

  test('allows an opted-out member to return as unpaid', () => {
    expect(isAllowedMealPlanTransition('OPTED_OUT', 'UNPAID')).toBe(true);
    expect(getMealPlanEmailTrigger('OPTED_OUT', 'UNPAID')).toBeNull();
  });
});
