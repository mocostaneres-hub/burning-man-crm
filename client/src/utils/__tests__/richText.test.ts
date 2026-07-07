import { renderRichTextToHtml } from '../richText';

describe('renderRichTextToHtml', () => {
  it('uses compact spacers for blank lines', () => {
    const html = renderRichTextToHtml('Hi Mo,\n\nYou are marked as enrolled.');

    expect(html).toContain('<p style="margin:0;line-height:1.5;">Hi Mo,</p>');
    expect(html).toContain('<div style="height:12px;line-height:12px;font-size:12px;">&nbsp;</div>');
    expect(html).toContain('<p style="margin:0;line-height:1.5;">You are marked as enrolled.</p>');
  });

  it('applies variables and supported inline formatting', () => {
    const html = renderRichTextToHtml('**Amount Due:** {{amount}}', { amount: '$100' });

    expect(html).toBe('<p style="margin:0;line-height:1.5;"><strong>Amount Due:</strong> $100</p>');
  });
});
