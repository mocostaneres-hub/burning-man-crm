const assert = require('assert');
const {
  DUES_STATUS,
  isAllowedTransition,
  getEmailTrigger,
  normalizeDuesStatus
} = require('../../server/utils/duesStateMachine');

function run() {
  assert.strictEqual(normalizeDuesStatus('Paid'), DUES_STATUS.PAID);
  assert.strictEqual(normalizeDuesStatus('Unpaid'), DUES_STATUS.UNPAID);
  assert.strictEqual(normalizeDuesStatus(DUES_STATUS.INSTRUCTED), DUES_STATUS.INSTRUCTED);

  assert.strictEqual(isAllowedTransition('UNPAID', 'INSTRUCTED'), true);
  assert.strictEqual(isAllowedTransition('UNPAID', 'PAID'), true);
  assert.strictEqual(isAllowedTransition('INSTRUCTED', 'PAID'), true);
  assert.strictEqual(isAllowedTransition('PAID', 'UNPAID'), true);
  assert.strictEqual(isAllowedTransition('INSTRUCTED', 'UNPAID'), false);

  assert.strictEqual(getEmailTrigger('UNPAID', 'INSTRUCTED'), 'instructions');
  assert.strictEqual(getEmailTrigger('INSTRUCTED', 'PAID'), 'receipt');
  assert.strictEqual(getEmailTrigger('PAID', 'UNPAID'), null);

  console.log('✅ Dues state machine tests passed');
}

run();
