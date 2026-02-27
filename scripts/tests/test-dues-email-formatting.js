const assert = require('assert');
const { renderDuesBodyHtml } = require('../../server/utils/duesEmailFormatter');

function run() {
  const markdownInput = [
    '# Main Title',
    '## Subtitle',
    '### Section',
    '',
    'This has **bold** and *italic* text.',
    '- First item',
    '• Second item'
  ].join('\n');

  const markdownHtml = renderDuesBodyHtml(markdownInput);
  assert.ok(markdownHtml.includes('<h1'), 'Should render markdown H1');
  assert.ok(markdownHtml.includes('<h2'), 'Should render markdown H2 (subtitle)');
  assert.ok(markdownHtml.includes('<h3'), 'Should render markdown H3 (section)');
  assert.ok(markdownHtml.includes('<strong>bold</strong>'), 'Should render bold text');
  assert.ok(markdownHtml.includes('<em>italic</em>'), 'Should render italic text');
  assert.ok(markdownHtml.includes('<li style="margin: 0 0 6px 0;">First item</li>'), 'Should render dash bullet list item');
  assert.ok(markdownHtml.includes('<li style="margin: 0 0 6px 0;">Second item</li>'), 'Should render dot bullet list item');

  const labeledInput = [
    'Title: Dues Payment Details',
    'Subtitle: Before You Pay',
    'Section: Accepted Methods',
    '- Venmo',
    '- Cash'
  ].join('\n');

  const labeledHtml = renderDuesBodyHtml(labeledInput);
  assert.ok(labeledHtml.includes('<h1'), 'Should render labeled Title');
  assert.ok(labeledHtml.includes('<h2'), 'Should render labeled Subtitle');
  assert.ok(labeledHtml.includes('<h3'), 'Should render labeled Section');

  const escapedHtml = renderDuesBodyHtml('Title: <script>alert(1)</script>');
  assert.ok(!escapedHtml.includes('<script>'), 'Should escape unsafe HTML');
  assert.ok(escapedHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'Should keep escaped script text');

  console.log('✅ Dues email rich-text formatting tests passed');
}

run();
