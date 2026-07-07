const { renderDuesBodyHtml } = require('../utils/duesEmailFormatter');

describe('dues email formatter', () => {
  test('renders blank lines as compact spacers instead of empty paragraphs', () => {
    const html = renderDuesBodyHtml('Hi Mo,\n\nYou are marked as enrolled.');

    expect(html).toContain('<div style="margin:0;line-height:1.4;">Hi Mo,</div>');
    expect(html).toContain('<div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>');
    expect(html).toContain('<div style="margin:0;line-height:1.4;">You are marked as enrolled.</div>');
    expect(html).not.toContain('<p style="margin: 0 0 12px 0;">&nbsp;</p>');
  });

  test('keeps supported formatting while escaping unsafe html', () => {
    const html = renderDuesBodyHtml('**Amount Due:** $100\n<script>alert("x")</script>');

    expect(html).toContain('<strong>Amount Due:</strong> $100');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });

  test('renders headings and lists with the same compact rhythm', () => {
    const html = renderDuesBodyHtml('# Payment Instructions\n- Venmo\n- Zelle');

    expect(html).toContain('<h2 style="margin:0 0 6px 0;font-size:18px;line-height:1.3;font-weight:700;">Payment Instructions</h2>');
    expect(html).toContain('<ul style="margin:0 0 6px 20px;padding:0;line-height:1.5;list-style:disc;">');
    expect(html).toContain('<li style="margin:0 0 2px 0;">Venmo</li>');
  });

  test('formats bold and italic inside bullet-heavy payment instructions', () => {
    const html = renderDuesBodyHtml([
      '## Your next step is to pay the camp dues.',
      'Our dues follow a tiered structure:',
      '- **Tier 1:** $425',
      '- **Tier 2:** *$500*',
      '**OR IF YOU ARE FEELING GENEROUS - SEE BELOW:**'
    ].join('\n'));

    expect(html).toContain('<strong>Tier 1:</strong> $425');
    expect(html).toContain('<em>$500</em>');
    expect(html).toContain('<strong>OR IF YOU ARE FEELING GENEROUS - SEE BELOW:</strong>');
    expect(html).not.toContain('**Tier 1:**');
    expect(html).not.toContain('*$500*');
  });
});
