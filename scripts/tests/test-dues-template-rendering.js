const assert = require('assert');
const { renderTemplate } = require('../../server/utils/renderTemplate');
const { getCampTemplate } = require('../../server/utils/duesTemplates');

function run() {
  const rendered = renderTemplate('Hi {{ member_name }} from {{camp_name}}', {
    member_name: 'Tester',
    camp_name: 'Dust Camp'
  });
  assert.strictEqual(rendered, 'Hi Tester from Dust Camp');

  // Unknown variables should be stripped, not executed.
  const safe = renderTemplate('Ignore {{constructor.constructor("return 1")()}} token', {});
  assert.strictEqual(safe, 'Ignore  token');

  const camp = {
    duesInstructionsSubject: null,
    duesInstructionsBody: null,
    duesReceiptSubject: 'Receipt {{camp_name}}',
    duesReceiptBody: 'Body {{member_name}}'
  };

  const instructions = getCampTemplate(camp, 'instructions');
  const receipt = getCampTemplate(camp, 'receipt');

  assert.ok(instructions.subject.includes('{{camp_name}}'));
  assert.strictEqual(receipt.subject, 'Receipt {{camp_name}}');
  assert.strictEqual(receipt.body, 'Body {{member_name}}');

  console.log('✅ Dues template rendering tests passed');
}

run();
