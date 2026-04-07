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
  let output = escapeHtml(text);
  output = output.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/\*(.+?)\*/g, '<em>$1</em>');
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
      html.push('<div style="height:8px"></div>');
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
      html.push(`<${level} style="margin:8px 0 4px 0;font-weight:700;">${formatInline(titleMatch[2])}</${level}>`);
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length === 1 ? 'h2' : headingMatch[1].length === 2 ? 'h3' : 'h4';
      html.push(`<${level} style="margin:8px 0 4px 0;font-weight:700;">${formatInline(headingMatch[2])}</${level}>`);
      continue;
    }

    const listMatch = line.match(/^[-*•]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        html.push('<ul style="margin:6px 0 6px 18px;padding:0;list-style:disc;">');
        inList = true;
      }
      html.push(`<li style="margin:2px 0;">${formatInline(listMatch[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p style="margin:6px 0;line-height:1.5;">${formatInline(line)}</p>`);
  }

  closeList();
  return html.join('');
};

export const FAQ_RICH_TEXT_GUIDE = [
  'Headings: # Title, ## Subtitle, ### Section',
  'Style: **bold** and *italic*',
  'Bullets: - item (or * item or • item)',
  'Blank line creates spacing between paragraphs'
];
