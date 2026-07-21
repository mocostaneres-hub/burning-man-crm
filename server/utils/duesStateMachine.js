const DUES_STATUS = {
  UNPAID: 'UNPAID',
  INSTRUCTED: 'INSTRUCTED',
  PAID: 'PAID'
};

const MEAL_PLAN_STATUS = {
  ...DUES_STATUS,
  OPTED_OUT: 'OPTED_OUT'
};

const LEGACY_TO_DUES_STATUS = {
  Unpaid: DUES_STATUS.UNPAID,
  Paid: DUES_STATUS.PAID
};

const ALLOWED_TRANSITIONS = new Set([
  `${DUES_STATUS.UNPAID}->${DUES_STATUS.INSTRUCTED}`,
  `${DUES_STATUS.UNPAID}->${DUES_STATUS.PAID}`,
  `${DUES_STATUS.INSTRUCTED}->${DUES_STATUS.PAID}`,
  `${DUES_STATUS.PAID}->${DUES_STATUS.UNPAID}`
]);

const ALLOWED_MEAL_PLAN_TRANSITIONS = new Set([
  ...ALLOWED_TRANSITIONS,
  `${MEAL_PLAN_STATUS.UNPAID}->${MEAL_PLAN_STATUS.OPTED_OUT}`,
  `${MEAL_PLAN_STATUS.INSTRUCTED}->${MEAL_PLAN_STATUS.OPTED_OUT}`,
  `${MEAL_PLAN_STATUS.PAID}->${MEAL_PLAN_STATUS.OPTED_OUT}`,
  `${MEAL_PLAN_STATUS.OPTED_OUT}->${MEAL_PLAN_STATUS.UNPAID}`
]);

function normalizeDuesStatus(status) {
  if (!status) return DUES_STATUS.UNPAID;
  return LEGACY_TO_DUES_STATUS[status] || status;
}

function normalizeMealPlanStatus(status) {
  if (!status) return MEAL_PLAN_STATUS.UNPAID;

  const normalized = String(status).trim().replace(/[\s-]+/g, '_').toUpperCase();
  if (Object.values(MEAL_PLAN_STATUS).includes(normalized)) {
    return normalized;
  }

  return normalizeDuesStatus(status);
}

function isAllowedTransition(previousStatus, nextStatus) {
  const from = normalizeDuesStatus(previousStatus);
  const to = normalizeDuesStatus(nextStatus);
  return ALLOWED_TRANSITIONS.has(`${from}->${to}`);
}

function isAllowedMealPlanTransition(previousStatus, nextStatus) {
  const from = normalizeMealPlanStatus(previousStatus);
  const to = normalizeMealPlanStatus(nextStatus);
  return ALLOWED_MEAL_PLAN_TRANSITIONS.has(`${from}->${to}`);
}

function getEmailTrigger(previousStatus, nextStatus) {
  const from = normalizeDuesStatus(previousStatus);
  const to = normalizeDuesStatus(nextStatus);

  if (from === DUES_STATUS.UNPAID && to === DUES_STATUS.INSTRUCTED) {
    return 'instructions';
  }
  if (from !== DUES_STATUS.PAID && to === DUES_STATUS.PAID) {
    return 'receipt';
  }
  return null;
}

function getMealPlanEmailTrigger(previousStatus, nextStatus) {
  const from = normalizeMealPlanStatus(previousStatus);
  const to = normalizeMealPlanStatus(nextStatus);

  if (from === MEAL_PLAN_STATUS.OPTED_OUT || to === MEAL_PLAN_STATUS.OPTED_OUT) {
    return null;
  }

  return getEmailTrigger(from, to);
}

module.exports = {
  DUES_STATUS,
  MEAL_PLAN_STATUS,
  normalizeDuesStatus,
  normalizeMealPlanStatus,
  isAllowedTransition,
  isAllowedMealPlanTransition,
  getEmailTrigger,
  getMealPlanEmailTrigger
};
