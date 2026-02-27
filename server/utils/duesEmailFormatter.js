const escapeHtml = (value = '') => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const applyInlineFormatting = (value = '') => {
  // Escape first, then allow a small safe subset of markdown-like formatting.
  let formatted = escapeHtml(value);
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');
  return formatted;
};

const getHeadingMeta = (trimmedLine = '') => {
  const markdownHeading = trimmedLine.match(/^(#{1,3})\s*(.+)$/);
  if (markdownHeading) {
    const level = markdownHeading[1].length;
    return {
      level,
      text: markdownHeading[2]
    };
  }

  const labeledHeading = trimmedLine.match(/^(title|subtitle|section)\s*:\s*(.+)$/i);
  if (!labeledHeading) return null;

  const label = labeledHeading[1].toLowerCase();
  const level = label === 'title' ? 1 : label === 'subtitle' ? 2 : 3;
  return {
    level,
    text: labeledHeading[2]
  };
};

const renderDuesBodyHtml = (body = '') => {
  const lines = body.split('\n');
  const htmlParts = [];
  let inList = false;

  const closeListIfOpen = () => {
    if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine || '';
    const trimmed = line.trim();

    if (!trimmed) {
      closeListIfOpen();
      htmlParts.push('<p style="margin: 0 0 12px 0;">&nbsp;</p>');
      return;
    }

    const heading = getHeadingMeta(trimmed);
    if (heading) {
      closeListIfOpen();
      const tag = heading.level === 1 ? 'h1' : heading.level === 2 ? 'h2' : 'h3';
      const size = heading.level === 1 ? '24px' : heading.level === 2 ? '20px' : '16px';
      htmlParts.push(
        `<${tag} style="margin: 0 0 12px 0; font-size: ${size}; line-height: 1.3;">${applyInlineFormatting(heading.text)}</${tag}>`
      );
      return;
    }

    const listMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        htmlParts.push('<ul style="margin: 0 0 12px 20px; padding: 0;">');
        inList = true;
      }
      htmlParts.push(`<li style="margin: 0 0 6px 0;">${applyInlineFormatting(listMatch[1])}</li>`);
      return;
    }

    closeListIfOpen();
    htmlParts.push(`<p style="margin: 0 0 12px 0;">${applyInlineFormatting(line)}</p>`);
  });

  closeListIfOpen();
  return htmlParts.join('');
};

module.exports = {
  escapeHtml,
  applyInlineFormatting,
  renderDuesBodyHtml
};
