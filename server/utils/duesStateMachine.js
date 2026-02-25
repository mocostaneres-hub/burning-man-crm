const DUES_STATUS = {
  UNPAID: 'UNPAID',
  INSTRUCTED: 'INSTRUCTED',
  PAID: 'PAID'
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

function normalizeDuesStatus(status) {
  if (!status) return DUES_STATUS.UNPAID;
  return LEGACY_TO_DUES_STATUS[status] || status;
}

function isAllowedTransition(previousStatus, nextStatus) {
  const from = normalizeDuesStatus(previousStatus);
  const to = normalizeDuesStatus(nextStatus);
  return ALLOWED_TRANSITIONS.has(`${from}->${to}`);
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

module.exports = {
  DUES_STATUS,
  normalizeDuesStatus,
  isAllowedTransition,
  getEmailTrigger
};
