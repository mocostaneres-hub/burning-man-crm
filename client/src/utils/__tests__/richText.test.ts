import { renderRichTextToHtml } from '../richText';

describe('renderRichTextToHtml', () => {
  it('uses compact spacers for blank lines', () => {
    const html = renderRichTextToHtml('Hi Mo,\n\nYou are marked as enrolled.');

    expect(html).toContain('<div style="margin:0;line-height:1.4;">Hi Mo,</div>');
    expect(html).toContain('<div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>');
    expect(html).toContain('<div style="margin:0;line-height:1.4;">You are marked as enrolled.</div>');
  });

  it('applies variables and supported inline formatting', () => {
    const html = renderRichTextToHtml('**Amount Due:** {{amount}}', { amount: '$100' });

    expect(html).toBe('<div style="margin:0;line-height:1.4;"><strong>Amount Due:</strong> $100</div>');
  });

  it('formats bold and italic inside bullet-heavy payment instructions', () => {
    const html = renderRichTextToHtml([
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
