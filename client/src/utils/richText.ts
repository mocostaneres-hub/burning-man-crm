type RichTextVariables = Record<string, string | number | null | undefined>;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const applyVariables = (text: string, variables?: RichTextVariables): string => {
  if (!variables) return text;
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = variables[key];
    if (value === null || value === undefined || value === '') {
      return match;
    }
    return String(value);
  });
};

const formatInline = (text: string): string => {
  const tokens: string[] = [];
  const protect = (html: string): string => {
    const token = `\u0000${tokens.length}\u0000`;
    tokens.push(html);
    return token;
  };
  const formatItalic = (value: string): string =>
    value
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
      .replace(/_([^_\n]+?)_/g, '<em>$1</em>');

  let output = escapeHtml(text);
  output = output.replace(/\*\*\*([^*\n]+?)\*\*\*/g, (_match, content: string) => protect(`<strong><em>${content}</em></strong>`));
  output = output.replace(/___([^_\n]+?)___/g, (_match, content: string) => protect(`<strong><em>${content}</em></strong>`));
  output = output.replace(/\*\*([^*\n]+?)\*\*/g, (_match, content: string) => protect(`<strong>${formatItalic(content)}</strong>`));
  output = output.replace(/__([^_\n]+?)__/g, (_match, content: string) => protect(`<strong>${formatItalic(content)}</strong>`));
  output = formatItalic(output);

  tokens.forEach((html, index) => {
    output = output.replace(new RegExp(`\u0000${index}\u0000`, 'g'), html);
  });
  return output;
};

export const renderRichTextToHtml = (body: string = '', variables?: RichTextVariables): string => {
  const source = applyVariables(String(body || ''), variables);
  const lines = source.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      html.push('<div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>');
      continue;
    }

    const titleMatch = line.match(/^(title|subtitle|section)\s*:\s*(.+)$/i);
    if (titleMatch) {
      closeList();
      const level =
        titleMatch[1].toLowerCase() === 'title'
          ? 'h2'
          : titleMatch[1].toLowerCase() === 'subtitle'
            ? 'h3'
            : 'h4';
      const size = level === 'h2' ? '18px' : level === 'h3' ? '16px' : '14px';
      html.push(`<${level} style="margin:0 0 6px 0;font-size:${size};line-height:1.3;font-weight:700;">${formatInline(titleMatch[2])}</${level}>`);
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s*(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length === 1 ? 'h2' : headingMatch[1].length === 2 ? 'h3' : 'h4';
      const size = level === 'h2' ? '18px' : level === 'h3' ? '16px' : '14px';
      html.push(`<${level} style="margin:0 0 6px 0;font-size:${size};line-height:1.3;font-weight:700;">${formatInline(headingMatch[2])}</${level}>`);
      continue;
    }

    const listMatch = line.match(/^[-*•]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        html.push('<ul style="margin:0 0 6px 20px;padding:0;line-height:1.5;list-style:disc;">');
        inList = true;
      }
      html.push(`<li style="margin:0 0 2px 0;">${formatInline(listMatch[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<div style="margin:0;line-height:1.4;">${formatInline(line)}</div>`);
  }

  closeList();
  return html.join('');
};

export const FAQ_RICH_TEXT_GUIDE = [
  'Headings: # Title, ## Subtitle, ### Section',
  'Style: **bold** and *italic*',
  'Bullets: - item (or * item or • item)',
  'Blank line creates a small paragraph break'
];
