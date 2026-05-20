const { URL } = require('url');
const net = require('net');

const PARSER_VERSION = 'survey-import-v1';
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 800 * 1024;

function decodeHtmlEntities(value) {
  if (!value) return '';
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value) {
  if (!value) return '';
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function sanitizeText(value, maxLen = 4000) {
  return stripTags(String(value || '')).slice(0, maxLen);
}

function parseAttributes(htmlTag) {
  const attrs = {};
  const regex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = regex.exec(htmlTag)) !== null) {
    const key = String(match[1] || '').toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    attrs[key] = value;
  }
  return attrs;
}

function isPrivateIpAddress(hostname) {
  if (!net.isIP(hostname)) return false;
  if (net.isIPv4(hostname)) {
    if (hostname.startsWith('10.')) return true;
    if (hostname.startsWith('127.')) return true;
    if (hostname.startsWith('169.254.')) return true;
    if (hostname.startsWith('192.168.')) return true;
    const octets = hostname.split('.').map(Number);
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    return false;
  }
  const lower = hostname.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

function normalizePublicFormUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    return { ok: false, reason: 'Invalid URL format' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: 'Only public http/https URLs are supported' };
  }

  const hostname = (parsed.hostname || '').toLowerCase();
  if (!hostname) {
    return { ok: false, reason: 'URL must include a hostname' };
  }

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost') ||
    isPrivateIpAddress(hostname)
  ) {
    return { ok: false, reason: 'Private or local URLs are not allowed' };
  }

  return {
    ok: true,
    normalizedUrl: parsed.toString(),
    origin: parsed.origin,
    pathname: parsed.pathname || '/'
  };
}

async function fetchWithLimits(url, { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'G8RoadSurveyImportBot/1.0',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const err = new Error(`Remote server returned status ${response.status}`);
    err.code = 'HTTP_STATUS_NOT_OK';
    err.meta = {
      httpStatus: response.status,
      contentType,
      finalUrl: response.url || url,
      durationMs: Date.now() - start
    };
    throw err;
  }

  if (!contentType.toLowerCase().includes('text/html')) {
    const err = new Error('URL is not an HTML page');
    err.code = 'UNSUPPORTED_CONTENT_TYPE';
    err.meta = {
      httpStatus: response.status,
      contentType,
      finalUrl: response.url || url,
      durationMs: Date.now() - start
    };
    throw err;
  }

  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    return {
      html: text.slice(0, maxBytes),
      fetchMeta: {
        httpStatus: response.status,
        contentType,
        finalUrl: response.url || url,
        byteSize: Buffer.byteLength(text || '', 'utf8'),
        durationMs: Date.now() - start
      }
    };
  }

  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const nextChunk = Buffer.from(value);
    size += nextChunk.length;
    if (size > maxBytes) {
      const err = new Error(`Remote form exceeds size limit (${maxBytes} bytes)`);
      err.code = 'CONTENT_TOO_LARGE';
      err.meta = {
        httpStatus: response.status,
        contentType,
        finalUrl: response.url || url,
        byteSize: size,
        durationMs: Date.now() - start
      };
      throw err;
    }
    chunks.push(nextChunk);
  }

  return {
    html: Buffer.concat(chunks).toString('utf8'),
    fetchMeta: {
      httpStatus: response.status,
      contentType,
      finalUrl: response.url || url,
      byteSize: size,
      durationMs: Date.now() - start
    }
  };
}

async function checkRobotsAllow(normalizedUrl) {
  try {
    const parsed = new URL(normalizedUrl);
    const robotsUrl = `${parsed.origin}/robots.txt`;
    const response = await fetch(robotsUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'G8RoadSurveyImportBot/1.0' }
    });

    if (!response.ok) return { allowed: true, reason: null };
    const text = await response.text();
    const evaluation = evaluateRobotsAccess(
      String(text || ''),
      parsed.pathname || '/',
      'G8RoadSurveyImportBot/1.0'
    );
    if (!evaluation.allowed) {
      return {
        allowed: false,
        reason: evaluation.matchedRule
          ? `robots.txt disallows scraping this path (${evaluation.matchedRule})`
          : 'robots.txt disallows scraping this path'
      };
    }
    return { allowed: true, reason: null };
  } catch (_error) {
    return { allowed: true, reason: null };
  }
}

function parseRobotsGroups(robotsText) {
  const lines = String(robotsText || '').split(/\r?\n/);
  const groups = [];
  let currentAgents = [];
  let currentRules = [];
  let hasRulesInCurrentGroup = false;

  const flushCurrentGroup = () => {
    if (currentAgents.length === 0) return;
    groups.push({
      agents: [...currentAgents],
      rules: [...currentRules]
    });
    currentAgents = [];
    currentRules = [];
    hasRulesInCurrentGroup = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const [directiveRaw, valueRaw = ''] = line.split(':', 2);
    const directive = directiveRaw.trim().toLowerCase();
    const value = valueRaw.trim();

    if (directive === 'user-agent') {
      if (hasRulesInCurrentGroup) {
        flushCurrentGroup();
      }
      currentAgents.push(value.toLowerCase());
      continue;
    }

    if (directive === 'allow' || directive === 'disallow') {
      if (currentAgents.length === 0) currentAgents = ['*'];
      hasRulesInCurrentGroup = true;
      currentRules.push({
        type: directive,
        pattern: value
      });
    }
  }

  flushCurrentGroup();
  return groups;
}

function robotAgentMatches(ruleAgent, userAgent) {
  const rule = String(ruleAgent || '').toLowerCase();
  const ua = String(userAgent || '').toLowerCase();
  if (!rule) return false;
  if (rule === '*') return true;
  return ua.includes(rule);
}

function escapeRegexLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function robotRuleMatchesPath(pattern, path) {
  if (pattern === '') return true;
  const rawPattern = String(pattern || '');
  const hasEndAnchor = rawPattern.endsWith('$');
  const withoutAnchor = hasEndAnchor ? rawPattern.slice(0, -1) : rawPattern;
  const regexPattern = withoutAnchor
    .split('*')
    .map((part) => escapeRegexLiteral(part))
    .join('.*');
  const fullPattern = `^${regexPattern}${hasEndAnchor ? '$' : ''}`;
  const regex = new RegExp(fullPattern);
  return regex.test(path);
}

function evaluateRobotsAccess(robotsText, path, userAgent = '*') {
  const groups = parseRobotsGroups(robotsText);
  const matchedGroups = groups.filter((group) =>
    group.agents.some((agent) => robotAgentMatches(agent, userAgent))
  );

  if (matchedGroups.length === 0) {
    return { allowed: true, matchedRule: null };
  }

  const groupSpecificity = (group) =>
    Math.max(
      ...group.agents
        .filter((agent) => robotAgentMatches(agent, userAgent))
        .map((agent) => (agent === '*' ? 0 : agent.length))
    );

  const maxSpecificity = Math.max(...matchedGroups.map(groupSpecificity));
  const applicableGroups = matchedGroups.filter((group) => groupSpecificity(group) === maxSpecificity);
  const rules = applicableGroups.flatMap((group) => group.rules);

  let winner = null;
  for (const rule of rules) {
    const pattern = String(rule.pattern || '');
    // Empty Disallow means "allow everything" and should not create a block.
    if (rule.type === 'disallow' && pattern === '') continue;
    if (!robotRuleMatchesPath(pattern, path)) continue;
    const score = pattern.length;
    if (!winner || score > winner.score || (score === winner.score && rule.type === 'allow')) {
      winner = { ...rule, score };
    }
  }

  if (!winner) return { allowed: true, matchedRule: null };
  return {
    allowed: winner.type !== 'disallow',
    matchedRule: winner.pattern || null
  };
}

function findLabelMaps(html) {
  const labelFor = new Map();
  const labelByName = new Map();
  const labelRegex = /<label\b([^>]*)>([\s\S]*?)<\/label>/gi;
  let match;

  while ((match = labelRegex.exec(html)) !== null) {
    const attrs = parseAttributes(match[1] || '');
    const labelText = sanitizeText(match[2] || '', 1000);
    if (!labelText) continue;
    if (attrs.for) labelFor.set(attrs.for, labelText);

    const nestedInput = (match[2] || '').match(/<input\b([^>]*)>/i);
    if (nestedInput) {
      const nestedAttrs = parseAttributes(nestedInput[1] || '');
      if (nestedAttrs.name) labelByName.set(nestedAttrs.name, labelText);
    }
  }

  return { labelFor, labelByName };
}

function guessQuestionLabel({ attrs, labelMaps }) {
  const idLabel = attrs.id ? labelMaps.labelFor.get(attrs.id) : '';
  const nameLabel = attrs.name ? labelMaps.labelByName.get(attrs.name) : '';
  const aria = attrs['aria-label'] || attrs.placeholder || '';
  return sanitizeText(idLabel || nameLabel || aria || attrs.name || 'Untitled question', 1200);
}

function asOptions(rawOptions) {
  return rawOptions
    .map((item) => sanitizeText(item, 1000))
    .filter(Boolean)
    .map((text) => ({ label: text, value: text, isOther: /^other$/i.test(text) }));
}

function parseSelectFields(html, labelMaps) {
  const fields = [];
  const regex = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const attrs = parseAttributes(match[1] || '');
    const options = [];
    const optionRegex = /<option\b[^>]*>([\s\S]*?)<\/option>/gi;
    let optionMatch;
    while ((optionMatch = optionRegex.exec(match[2] || '')) !== null) {
      const optionText = sanitizeText(optionMatch[1], 1000);
      if (optionText) options.push(optionText);
    }
    fields.push({
      blockType: 'dropdown',
      prompt: guessQuestionLabel({ attrs, labelMaps }),
      required: attrs.required !== undefined || attrs['aria-required'] === 'true',
      options: asOptions(options),
      validation: { kind: 'none', min: null, max: null, pattern: null },
      supportLevel: 'supported',
      warnings: [],
      sourceMeta: { externalType: 'select', confidence: 0.85, rawName: attrs.name || null },
      isSuggestion: true
    });
  }
  return fields;
}

function parseTextareaFields(html, labelMaps) {
  const fields = [];
  const regex = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const attrs = parseAttributes(match[1] || '');
    fields.push({
      blockType: 'paragraph',
      prompt: guessQuestionLabel({ attrs, labelMaps }),
      required: attrs.required !== undefined || attrs['aria-required'] === 'true',
      options: [],
      validation: { kind: 'text', min: null, max: null, pattern: null },
      supportLevel: 'supported',
      warnings: [],
      sourceMeta: { externalType: 'textarea', confidence: 0.9, rawName: attrs.name || null },
      isSuggestion: true
    });
  }
  return fields;
}

function mapInputTypeToQuestionType(typeValue) {
  const type = String(typeValue || 'text').toLowerCase();
  if (['text', 'email', 'number', 'url', 'tel', 'search'].includes(type)) return 'short_answer';
  if (type === 'date') return 'date';
  if (type === 'time') return 'time';
  if (type === 'range') return 'linear_scale';
  return 'unsupported';
}

function parseInputFields(html, labelMaps) {
  const grouped = new Map();
  const singles = [];
  const regex = /<input\b([^>]*)>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const attrs = parseAttributes(match[1] || '');
    const type = String(attrs.type || 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'password'].includes(type)) continue;
    if (type === 'radio' || type === 'checkbox') {
      const key = `${type}:${attrs.name || attrs.id || Math.random().toString(36)}`;
      const existing = grouped.get(key) || { attrs, type, options: [] };
      const optionLabel = guessQuestionLabel({ attrs, labelMaps }) || sanitizeText(attrs.value || 'Option', 1000);
      existing.options.push(optionLabel);
      existing.attrs = attrs;
      grouped.set(key, existing);
      continue;
    }
    singles.push(attrs);
  }

  const output = [];

  for (const attrs of singles) {
    const mapped = mapInputTypeToQuestionType(attrs.type);
    if (mapped === 'unsupported') {
      output.push({
        blockType: 'unsupported',
        prompt: guessQuestionLabel({ attrs, labelMaps }),
        required: false,
        options: [],
        validation: { kind: 'none', min: null, max: null, pattern: null },
        supportLevel: 'unsupported',
        warnings: [`Input type "${attrs.type || 'unknown'}" is not directly supported`],
        sourceMeta: { externalType: `input:${attrs.type || 'unknown'}`, confidence: 0.4, rawName: attrs.name || null },
        isSuggestion: true
      });
      continue;
    }

    const validationKind =
      mapped === 'short_answer'
        ? (['email', 'number', 'url'].includes(String(attrs.type || '').toLowerCase()) ? String(attrs.type).toLowerCase() : 'text')
        : 'none';
    const warnings = [];
    if (attrs.pattern) warnings.push('Pattern validation was detected and may require manual review');

    output.push({
      blockType: mapped,
      prompt: guessQuestionLabel({ attrs, labelMaps }),
      required: attrs.required !== undefined || attrs['aria-required'] === 'true',
      options: [],
      linearScale:
        mapped === 'linear_scale'
          ? {
              min: Number(attrs.min || 1),
              max: Number(attrs.max || 5),
              minLabel: '',
              maxLabel: ''
            }
          : undefined,
      validation: {
        kind: validationKind,
        min: attrs.min !== undefined ? Number(attrs.min) : null,
        max: attrs.max !== undefined ? Number(attrs.max) : null,
        pattern: attrs.pattern || null
      },
      supportLevel: mapped === 'linear_scale' ? 'partial' : 'supported',
      warnings,
      sourceMeta: { externalType: `input:${attrs.type || 'text'}`, confidence: 0.82, rawName: attrs.name || null },
      isSuggestion: true
    });
  }

  for (const group of grouped.values()) {
    const blockType = group.type === 'radio' ? 'multiple_choice' : 'checkboxes';
    output.push({
      blockType,
      prompt: guessQuestionLabel({ attrs: group.attrs, labelMaps }),
      required: group.attrs.required !== undefined || group.attrs['aria-required'] === 'true',
      options: asOptions(group.options),
      validation: { kind: 'none', min: null, max: null, pattern: null },
      supportLevel: 'supported',
      warnings: [],
      sourceMeta: { externalType: `input:${group.type}`, confidence: 0.86, rawName: group.attrs.name || null },
      isSuggestion: true
    });
  }

  return output;
}

function parseSectionHeaders(html) {
  const blocks = [];
  const regex = /<(h2|h3|legend)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = sanitizeText(match[2], 1000);
    if (!text) continue;
    blocks.push({
      blockType: 'section_header',
      prompt: text,
      required: false,
      options: [],
      validation: { kind: 'none', min: null, max: null, pattern: null },
      supportLevel: 'supported',
      warnings: [],
      sourceMeta: { externalType: match[1], confidence: 0.75, rawName: null },
      isSuggestion: true
    });
  }
  return blocks;
}

function parseMediaBlocks(html) {
  const blocks = [];
  const imageRegex = /<img\b([^>]*)>/gi;
  let imageMatch;
  while ((imageMatch = imageRegex.exec(html)) !== null) {
    const attrs = parseAttributes(imageMatch[1] || '');
    if (!attrs.src) continue;
    blocks.push({
      blockType: 'image_block',
      prompt: sanitizeText(attrs.alt || 'Imported image', 1000),
      required: false,
      mediaUrl: attrs.src,
      options: [],
      validation: { kind: 'none', min: null, max: null, pattern: null },
      supportLevel: 'partial',
      warnings: ['Image blocks are imported as references and may need manual formatting'],
      sourceMeta: { externalType: 'img', confidence: 0.7, rawName: attrs.alt || null },
      isSuggestion: true
    });
  }

  const videoRegex = /<(video|iframe)\b([^>]*)>/gi;
  let videoMatch;
  while ((videoMatch = videoRegex.exec(html)) !== null) {
    const attrs = parseAttributes(videoMatch[2] || '');
    const src = attrs.src || null;
    if (!src) continue;
    blocks.push({
      blockType: 'video_block',
      prompt: sanitizeText(attrs.title || 'Imported media', 1000),
      required: false,
      mediaUrl: src,
      options: [],
      validation: { kind: 'none', min: null, max: null, pattern: null },
      supportLevel: 'partial',
      warnings: ['Video embeds are imported as references and may need manual review'],
      sourceMeta: { externalType: videoMatch[1], confidence: 0.6, rawName: attrs.title || null },
      isSuggestion: true
    });
  }
  return blocks;
}

function parseGridTables(html) {
  const blocks = [];
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let match;
  while ((match = tableRegex.exec(html)) !== null) {
    const tableHtml = match[1] || '';
    if (!/<input\b/i.test(tableHtml)) continue;
    const inputTypes = Array.from(tableHtml.matchAll(/<input\b([^>]*)>/gi))
      .map((m) => parseAttributes(m[1] || '').type || 'text')
      .map((t) => String(t).toLowerCase());

    const hasRadio = inputTypes.includes('radio');
    const hasCheckbox = inputTypes.includes('checkbox');
    if (!hasRadio && !hasCheckbox) continue;

    const rowMatches = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
    if (rowMatches.length < 2) continue;

    const headerCells = Array.from((rowMatches[0][1] || '').matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi))
      .map((cell) => sanitizeText(cell[2], 1000))
      .filter(Boolean);
    const columns = headerCells.slice(1);
    const rows = [];
    for (const rowMatch of rowMatches.slice(1)) {
      const cells = Array.from((rowMatch[1] || '').matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi))
        .map((cell) => sanitizeText(cell[2], 1000))
        .filter(Boolean);
      if (cells.length > 0) rows.push(cells[0]);
    }

    if (rows.length === 0 || columns.length === 0) continue;
    blocks.push({
      blockType: hasRadio ? 'multiple_choice_grid' : 'checkbox_grid',
      prompt: 'Imported grid question',
      required: false,
      rows,
      columns,
      options: [],
      validation: { kind: 'none', min: null, max: null, pattern: null },
      supportLevel: 'partial',
      warnings: ['Grid mapping was inferred and should be reviewed before sending'],
      sourceMeta: { externalType: 'table-grid', confidence: 0.55, rawName: null },
      isSuggestion: true
    });
  }
  return blocks;
}

function dedupeQuestionBlocks(blocks) {
  const seen = new Set();
  const output = [];
  for (const block of blocks) {
    const key = `${block.blockType}:${block.prompt}:${(block.options || []).map((o) => o.value).join('|')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(block);
  }
  return output;
}

function parseFormTitle(html) {
  const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return sanitizeText(h1Match[1], 240);
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return sanitizeText(titleMatch[1], 240);
  return 'Imported Survey Draft';
}

function parseFormDescription(html) {
  const metaMatch = html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (metaMatch) return sanitizeText(metaMatch[1], 4000);
  const firstParagraph = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (firstParagraph) return sanitizeText(firstParagraph[1], 4000);
  return '';
}

function parsePublicFormToSuggestion(html) {
  const sanitizedHtml = String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');

  const labelMaps = findLabelMaps(sanitizedHtml);
  const blocks = [];
  blocks.push(...parseSectionHeaders(sanitizedHtml));
  blocks.push(...parseMediaBlocks(sanitizedHtml));
  blocks.push(...parseGridTables(sanitizedHtml));
  blocks.push(...parseTextareaFields(sanitizedHtml, labelMaps));
  blocks.push(...parseSelectFields(sanitizedHtml, labelMaps));
  blocks.push(...parseInputFields(sanitizedHtml, labelMaps));

  const dedupedBlocks = dedupeQuestionBlocks(blocks);
  const unsupportedCount = dedupedBlocks.filter((b) => b.supportLevel === 'unsupported').length;
  const warnings = [];
  if (dedupedBlocks.length === 0) {
    warnings.push('No recognizable fields were detected. You can still build the survey manually.');
  }
  if (unsupportedCount > 0) {
    warnings.push(`${unsupportedCount} imported field(s) need manual review before sending.`);
  }

  return {
    title: parseFormTitle(sanitizedHtml),
    description: parseFormDescription(sanitizedHtml),
    blocks: dedupedBlocks,
    warnings,
    unsupportedCount,
    parserVersion: PARSER_VERSION
  };
}

async function analyzePublicFormUrl(rawUrl) {
  const normalized = normalizePublicFormUrl(rawUrl);
  if (!normalized.ok) {
    return {
      ok: false,
      status: 'rejected_private',
      normalizedUrl: null,
      suggestion: null,
      fetchMeta: {},
      errorMessage: normalized.reason
    };
  }

  const robots = await checkRobotsAllow(normalized.normalizedUrl);
  if (!robots.allowed) {
    return {
      ok: false,
      status: 'rejected_inaccessible',
      normalizedUrl: normalized.normalizedUrl,
      suggestion: null,
      fetchMeta: {},
      errorMessage: robots.reason
    };
  }

  try {
    const { html, fetchMeta } = await fetchWithLimits(normalized.normalizedUrl);
    const suggestion = parsePublicFormToSuggestion(html);
    return {
      ok: true,
      status: 'parsed',
      normalizedUrl: normalized.normalizedUrl,
      suggestion,
      fetchMeta
    };
  } catch (error) {
    return {
      ok: false,
      status: 'rejected_inaccessible',
      normalizedUrl: normalized.normalizedUrl,
      suggestion: null,
      fetchMeta: error.meta || {},
      errorMessage: error.message || 'Unable to access or parse the public form URL'
    };
  }
}

module.exports = {
  PARSER_VERSION,
  normalizePublicFormUrl,
  parsePublicFormToSuggestion,
  analyzePublicFormUrl,
  evaluateRobotsAccess
};
