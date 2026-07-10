import { renderRichTextToHtml as toRichTextHtml } from '../richText';

describe('renderRichTextToHtml', () => {
  it('uses compact spacers for blank lines', () => {
    const output = toRichTextHtml('Hi Mo,\n\nYou are marked as enrolled.');

    expect(output).toContain('<div style="margin:0;line-height:1.4;">Hi Mo,</div>');
    expect(output).toContain('<div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>');
    expect(output).toContain('<div style="margin:0;line-height:1.4;">You are marked as enrolled.</div>');
  });

  it('applies variables and supported inline formatting', () => {
    const output = toRichTextHtml('**Amount Due:** {{amount}}', { amount: '$100' });

    expect(output).toBe('<div style="margin:0;line-height:1.4;"><strong>Amount Due:</strong> $100</div>');
    expect(output).not.toContain('<em>Amount Due:</em>');
  });

  it('formats bold and italic inside bullet-heavy payment instructions', () => {
    const output = toRichTextHtml([
      '## Your next step is to pay the camp dues.',
      'Our dues follow a tiered structure:',
      '- **Tier 1:** $425',
      '- **Tier 2:** *$500*',
      '**OR IF YOU ARE FEELING GENEROUS - SEE BELOW:**'
    ].join('\n'));

    expect(output).toContain('<strong>Tier 1:</strong> $425');
    expect(output).toContain('<em>$500</em>');
    expect(output).toContain('<strong>OR IF YOU ARE FEELING GENEROUS - SEE BELOW:</strong>');
    expect(output).not.toContain('**Tier 1:**');
    expect(output).not.toContain('*$500*');
  });

  it('does not reinterpret bold markers as italic', () => {
    const output = toRichTextHtml('**bold** and *italic* and ***both***');

    expect(output).toContain('<strong>bold</strong>');
    expect(output).toContain('<em>italic</em>');
    expect(output).toContain('<strong><em>both</em></strong>');
    expect(output).not.toContain('<em>bold</em>');
    expect(output).not.toContain('<strong><em>bold</strong></em>');
  });
});
