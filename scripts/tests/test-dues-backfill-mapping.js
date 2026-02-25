const assert = require('assert');

function mapLegacyMember(member) {
  const next = { ...member };
  const paidBoolean = typeof next.paid === 'boolean' ? next.paid : next.duesPaid;
  const legacyStatus = next.duesStatus;

  if (paidBoolean === true || legacyStatus === 'Paid' || legacyStatus === 'PAID') {
    next.duesStatus = 'PAID';
    next.paid = true;
    next.duesPaidAt = next.duesPaidAt || next.paidAt || new Date();
    return next;
  }

  if (paidBoolean === false || legacyStatus === 'Unpaid' || !legacyStatus) {
    next.duesStatus = 'UNPAID';
    next.paid = false;
    return next;
  }

  if (legacyStatus === 'INSTRUCTED' || legacyStatus === 'UNPAID') {
    return next;
  }

  next.duesStatus = 'UNPAID';
  next.paid = false;
  return next;
}

function run() {
  const paidMember = mapLegacyMember({ paid: true, duesStatus: 'Unpaid' });
  assert.strictEqual(paidMember.duesStatus, 'PAID');
  assert.strictEqual(paidMember.paid, true);

  const unpaidMember = mapLegacyMember({ paid: false, duesStatus: 'Unpaid' });
  assert.strictEqual(unpaidMember.duesStatus, 'UNPAID');
  assert.strictEqual(unpaidMember.paid, false);

  const instructedMember = mapLegacyMember({ duesStatus: 'INSTRUCTED' });
  assert.strictEqual(instructedMember.duesStatus, 'INSTRUCTED');

  console.log('✅ Dues backfill mapping tests passed');
}

run();
