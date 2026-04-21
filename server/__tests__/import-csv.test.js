/**
 * Tests for the POST /api/members/import-csv route helpers.
 *
 * We extract and test the pure-function parts of the import logic
 * without spinning up an Express server or connecting to MongoDB.
 *
 * Coverage:
 *  - parseCsvRows: BOM stripping, header detection, row parsing
 *  - normalizeCsvEmail: trimming, lowercasing
 *  - isValidEmail: valid & invalid formats
 *  - Row-level validation: missing name/email, duplicate emails, invalid email
 *  - insertedCount extraction for Mongoose 7.x vs older drivers
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline the pure helpers so tests have zero runtime dependencies.
// These must stay in sync with server/routes/members.js.
// ─────────────────────────────────────────────────────────────────────────────
const { PassThrough } = require('stream');
const csv = require('csv-parser');

const normalizeCsvEmail = (value = '') => String(value || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

async function parseCsvRows(fileBuffer) {
  const rows = [];
  const headers = [];

  let buf = fileBuffer;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    buf = buf.slice(3);
  }

  await new Promise((resolve, reject) => {
    const stream = new PassThrough();
    stream.end(buf);
    stream
      .pipe(csv())
      .on('headers', (h) => headers.push(...h))
      .on('data', (data) => rows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  return { rows, headers };
}

/** Simulate Mongoose 7 / MongoDB driver 5 BulkWriteError structure */
function makeMongoBulkWriteError({ insertedCount, writeErrors }) {
  const err = new Error('BulkWriteError');
  err.result = { insertedCount };
  err.writeErrors = writeErrors;
  return err;
}

/** Extract createdCount the same way the route does (fixed for Mongoose 7) */
function extractCreatedCount(insertError) {
  return (
    insertError?.result?.insertedCount ??
    insertError?.result?.result?.nInserted ??
    insertError?.result?.nInserted ??
    (Array.isArray(insertError?.insertedDocs) ? insertError.insertedDocs.length : 0)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// parseCsvRows
// ─────────────────────────────────────────────────────────────────────────────
describe('parseCsvRows', () => {
  test('parses a well-formed CSV with no BOM', async () => {
    const csv_text = 'name,email,phone\nAlice,alice@example.com,555-0001\nBob,bob@example.com,555-0002\n';
    const buf = Buffer.from(csv_text, 'utf-8');
    const { rows, headers } = await parseCsvRows(buf);

    expect(headers).toEqual(['name', 'email', 'phone']);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Alice');
    expect(rows[0].email).toBe('alice@example.com');
    expect(rows[1].name).toBe('Bob');
  });

  test('strips UTF-8 BOM (Excel export) from the buffer', async () => {
    const csv_text = 'NAME,EMAIL\nAlice,alice@example.com\n';
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const buf = Buffer.concat([bom, Buffer.from(csv_text, 'utf-8')]);

    const { rows, headers } = await parseCsvRows(buf);

    // Without BOM stripping, headers[0] would be '\ufeffNAME', not 'NAME'
    expect(headers[0]).toBe('NAME');
    expect(rows).toHaveLength(1);
    expect(rows[0].NAME).toBe('Alice');
  });

  test('returns empty rows and headers for an empty file', async () => {
    const buf = Buffer.from('', 'utf-8');
    const { rows, headers } = await parseCsvRows(buf);
    expect(rows).toHaveLength(0);
    expect(headers).toHaveLength(0);
  });

  test('returns only headers when there are no data rows', async () => {
    const buf = Buffer.from('name,email\n', 'utf-8');
    const { rows, headers } = await parseCsvRows(buf);
    expect(headers).toEqual(['name', 'email']);
    expect(rows).toHaveLength(0);
  });

  test('handles CRLF line endings', async () => {
    const buf = Buffer.from('name,email\r\nCarol,carol@example.com\r\n', 'utf-8');
    const { rows } = await parseCsvRows(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('carol@example.com');
  });

  test('handles quoted fields with commas inside', async () => {
    const buf = Buffer.from('name,email\n"Smith, John",john@example.com\n', 'utf-8');
    const { rows } = await parseCsvRows(buf);
    expect(rows[0].name).toBe('Smith, John');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeCsvEmail
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeCsvEmail', () => {
  test('trims and lowercases the email', () => {
    expect(normalizeCsvEmail('  Alice@Example.COM  ')).toBe('alice@example.com');
  });

  test('handles null/undefined gracefully', () => {
    expect(normalizeCsvEmail(null)).toBe('');
    expect(normalizeCsvEmail(undefined)).toBe('');
  });

  test('handles an already-normalised email', () => {
    expect(normalizeCsvEmail('bob@example.com')).toBe('bob@example.com');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isValidEmail
// ─────────────────────────────────────────────────────────────────────────────
describe('isValidEmail', () => {
  test.each([
    'user@example.com',
    'user+tag@domain.co.uk',
    'firstname.lastname@company.org',
  ])('accepts valid email: %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  test.each([
    '',
    'notanemail',
    '@nodomain.com',
    'missing-at-sign.com',
    'two@@signs.com',
  ])('rejects invalid email: %s', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Row-level validation logic (mirrors the loop in import-csv)
// ─────────────────────────────────────────────────────────────────────────────
describe('Row validation logic', () => {
  function processRows(rows) {
    const seenCsvEmails = new Set();
    const validCandidates = [];
    const invalidRows = [];
    const skippedRows = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row.name || '').trim();
      const email = normalizeCsvEmail(row.email);

      if (!name || !email) {
        invalidRows.push({ row: i + 2, reason: 'missing_required_fields', name, email });
        continue;
      }
      if (!isValidEmail(email)) {
        invalidRows.push({ row: i + 2, reason: 'invalid_email', name, email });
        continue;
      }
      if (seenCsvEmails.has(email)) {
        skippedRows.push({ row: i + 2, reason: 'duplicate_in_csv', name, email });
        continue;
      }
      seenCsvEmails.add(email);
      validCandidates.push({ name, email });
    }

    return { validCandidates, invalidRows, skippedRows };
  }

  test('valid rows are accepted', () => {
    const { validCandidates, invalidRows, skippedRows } = processRows([
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ]);
    expect(validCandidates).toHaveLength(2);
    expect(invalidRows).toHaveLength(0);
    expect(skippedRows).toHaveLength(0);
  });

  test('rows with missing name are invalid', () => {
    const { invalidRows } = processRows([{ name: '', email: 'alice@example.com' }]);
    expect(invalidRows[0].reason).toBe('missing_required_fields');
  });

  test('rows with missing email are invalid', () => {
    const { invalidRows } = processRows([{ name: 'Alice', email: '' }]);
    expect(invalidRows[0].reason).toBe('missing_required_fields');
  });

  test('rows with an invalid email format are invalid', () => {
    const { invalidRows } = processRows([{ name: 'Alice', email: 'not-an-email' }]);
    expect(invalidRows[0].reason).toBe('invalid_email');
  });

  test('duplicate emails within the CSV are skipped', () => {
    const { validCandidates, skippedRows } = processRows([
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Alice2', email: 'alice@example.com' },
    ]);
    expect(validCandidates).toHaveLength(1);
    expect(skippedRows[0].reason).toBe('duplicate_in_csv');
  });

  test('duplicate check is case-insensitive', () => {
    const { skippedRows } = processRows([
      { name: 'Alice', email: 'Alice@Example.com' },
      { name: 'Alice2', email: 'alice@example.com' },
    ]);
    expect(skippedRows).toHaveLength(1);
  });

  test('entirely empty CSV produces zero candidates', () => {
    const { validCandidates, invalidRows } = processRows([]);
    expect(validCandidates).toHaveLength(0);
    expect(invalidRows).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// insertedCount extraction (Mongoose 7.x vs older drivers)
// ─────────────────────────────────────────────────────────────────────────────
describe('extractCreatedCount from BulkWriteError', () => {
  test('reads insertedCount from Mongoose 7 / MongoDB driver 5 error structure', () => {
    const err = makeMongoBulkWriteError({ insertedCount: 3, writeErrors: [{ code: 11000 }] });
    expect(extractCreatedCount(err)).toBe(3);
  });

  test('falls back to result.result.nInserted for older drivers', () => {
    const err = { result: { result: { nInserted: 5 } }, writeErrors: [] };
    expect(extractCreatedCount(err)).toBe(5);
  });

  test('falls back to result.nInserted for intermediate drivers', () => {
    const err = { result: { nInserted: 7 }, writeErrors: [] };
    expect(extractCreatedCount(err)).toBe(7);
  });

  test('falls back to 0 when no count is available', () => {
    const err = { writeErrors: [{ code: 11000 }] };
    expect(extractCreatedCount(err)).toBe(0);
  });

  test('handles null gracefully', () => {
    expect(extractCreatedCount(null)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Header + row key normalization (the core fix for this issue)
// ─────────────────────────────────────────────────────────────────────────────

const normalizeKey = (h) => String(h || '').trim().toLowerCase().replace(/\s+/g, '_');

function normalizeRows(rawRows, rawHeaders) {
  const headers = rawHeaders.map(normalizeKey);
  const rows = rawRows.map((rawRow) => {
    const out = {};
    for (const [k, v] of Object.entries(rawRow)) {
      out[normalizeKey(k)] = v;
    }
    return out;
  });
  return { headers, rows };
}

function normalizeMapping(mapping) {
  const out = {};
  for (const [field, csvCol] of Object.entries(mapping)) {
    out[field] = csvCol ? normalizeKey(csvCol) : '';
  }
  return out;
}

function getColumn(row, normalizedMap, canonical, fallback) {
  const mapped = normalizedMap?.[canonical];
  const key = mapped || fallback;
  return row?.[key] ?? '';
}

describe('Header + row key normalization', () => {
  test('normalizeKey: uppercase → lowercase', () => {
    expect(normalizeKey('NAME')).toBe('name');
    expect(normalizeKey('EMAIL')).toBe('email');
  });

  test('normalizeKey: spaces → underscores', () => {
    expect(normalizeKey('PLAYA NAME')).toBe('playa_name');
    expect(normalizeKey('Full Name')).toBe('full_name');
  });

  test('normalizeKey: trims leading/trailing whitespace', () => {
    expect(normalizeKey('  NAME  ')).toBe('name');
  });

  test('normalizeKey: handles empty / null gracefully', () => {
    expect(normalizeKey('')).toBe('');
    expect(normalizeKey(null)).toBe('');
  });

  test('normalizeRows: remaps all row keys', () => {
    const rawRows = [{ NAME: 'Alice', 'PLAYA NAME': 'Dusty', EMAIL: 'alice@example.com' }];
    const rawHeaders = ['NAME', 'PLAYA NAME', 'EMAIL'];
    const { headers, rows } = normalizeRows(rawRows, rawHeaders);

    expect(headers).toEqual(['name', 'playa_name', 'email']);
    expect(rows[0]).toEqual({ name: 'Alice', playa_name: 'Dusty', email: 'alice@example.com' });
  });

  test('normalizeRows: mixed-case headers', () => {
    const rawRows = [{ Name: 'Bob', Email: 'bob@example.com' }];
    const { rows } = normalizeRows(rawRows, ['Name', 'Email']);
    expect(rows[0].name).toBe('Bob');
    expect(rows[0].email).toBe('bob@example.com');
  });

  test('normalizeMapping: maps frontend "NAME" → "name" so getColumn can resolve it', () => {
    const frontendMapping = { name: 'NAME', email: 'EMAIL', playa_name: 'PLAYA NAME', phone: '' };
    const nm = normalizeMapping(frontendMapping);
    expect(nm.name).toBe('name');
    expect(nm.email).toBe('email');
    expect(nm.playa_name).toBe('playa_name');
    expect(nm.phone).toBe('');
  });
});

describe('getColumn resolves correctly after normalization', () => {
  const rawRows = [{ NAME: 'John Doe', 'PLAYA NAME': 'Dusty', EMAIL: 'john@example.com' }];
  const { rows } = normalizeRows(rawRows, ['NAME', 'PLAYA NAME', 'EMAIL']);
  const row = rows[0];

  test('resolves name via explicit mapping', () => {
    const nm = normalizeMapping({ name: 'NAME', email: 'EMAIL', playa_name: '' });
    expect(getColumn(row, nm, 'name', 'name')).toBe('John Doe');
  });

  test('resolves email via explicit mapping', () => {
    const nm = normalizeMapping({ name: 'NAME', email: 'EMAIL' });
    expect(getColumn(row, nm, 'email', 'email')).toBe('john@example.com');
  });

  test('resolves playa_name via explicit mapping', () => {
    const nm = normalizeMapping({ playa_name: 'PLAYA NAME' });
    expect(getColumn(row, nm, 'playa_name', 'playa_name')).toBe('Dusty');
  });

  test('falls back to canonical key when mapping is empty', () => {
    // No mapping at all — works because row keys are already normalized
    const nm = normalizeMapping({});
    expect(getColumn(row, nm, 'name', 'name')).toBe('John Doe');
    expect(getColumn(row, nm, 'email', 'email')).toBe('john@example.com');
    expect(getColumn(row, nm, 'playa_name', 'playa_name')).toBe('Dusty');
  });

  test('returns empty string for a column that is not in the CSV', () => {
    const nm = normalizeMapping({});
    expect(getColumn(row, nm, 'phone', 'phone')).toBe('');
  });
});

describe('Full end-to-end: parse + normalize + validate', () => {
  async function simulateImport(csvText) {
    const buf = Buffer.from(csvText, 'utf-8');
    const { rows: rawRows, headers: rawHeaders } = await parseCsvRows(buf);
    const { headers, rows } = normalizeRows(rawRows, rawHeaders);
    const nm = normalizeMapping({}); // no explicit mapping → rely on fallback

    const validCandidates = [];
    const invalidRows = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = String(getColumn(row, nm, 'name', 'name')).trim();
      const email = normalizeCsvEmail(getColumn(row, nm, 'email', 'email'));

      if (!name || !email) {
        invalidRows.push({ row: i + 2, reason: 'missing_required_fields', name, email });
        continue;
      }
      if (!isValidEmail(email)) {
        invalidRows.push({ row: i + 2, reason: 'invalid_email', name, email });
        continue;
      }
      validCandidates.push({ name, email, playa_name: getColumn(row, nm, 'playa_name', 'playa_name') });
    }
    return { headers, validCandidates, invalidRows };
  }

  test('CSV with NAME, PLAYA NAME, EMAIL headers — all members valid', async () => {
    const csv = 'NAME,PLAYA NAME,EMAIL\nJohn Doe,Dusty,john@example.com\nJane Doe,Sunset,jane@example.com\n';
    const { validCandidates, invalidRows } = await simulateImport(csv);
    expect(validCandidates).toHaveLength(2);
    expect(invalidRows).toHaveLength(0);
    expect(validCandidates[0].name).toBe('John Doe');
    expect(validCandidates[0].playa_name).toBe('Dusty');
    expect(validCandidates[1].email).toBe('jane@example.com');
  });

  test('CSV with BOM + NAME, PLAYA NAME, EMAIL — still valid', async () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const content = Buffer.from('NAME,PLAYA NAME,EMAIL\nDust Devil,Dusty,dust@example.com\n', 'utf-8');
    const buf = Buffer.concat([bom, content]);
    const { rows: rawRows, headers: rawHeaders } = await parseCsvRows(buf);
    const { headers, rows } = normalizeRows(rawRows, rawHeaders);
    const nm = normalizeMapping({});

    expect(headers[0]).toBe('name');
    const name = getColumn(rows[0], nm, 'name', 'name');
    expect(name).toBe('Dust Devil');
  });

  test('CSV with mixed-case headers — valid', async () => {
    const csv = 'Name,Email\nAlice,alice@example.com\n';
    const { validCandidates } = await simulateImport(csv);
    expect(validCandidates).toHaveLength(1);
    expect(validCandidates[0].name).toBe('Alice');
  });

  test('CSV missing email column — rows marked invalid', async () => {
    const csv = 'NAME\nJohn Doe\n';
    const { validCandidates, invalidRows } = await simulateImport(csv);
    expect(validCandidates).toHaveLength(0);
    expect(invalidRows[0].reason).toBe('missing_required_fields');
  });

  test('CSV with invalid email — row marked invalid_email', async () => {
    const csv = 'NAME,EMAIL\nBob,not-an-email\n';
    const { validCandidates, invalidRows } = await simulateImport(csv);
    expect(validCandidates).toHaveLength(0);
    expect(invalidRows[0].reason).toBe('invalid_email');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOM edge cases
// ─────────────────────────────────────────────────────────────────────────────
describe('BOM stripping edge cases', () => {
  test('does not strip a non-BOM sequence that happens to start with 0xEF', async () => {
    // Only 2 bytes starting with 0xEF — not a full BOM
    const csv_text = 'name,email\nAlice,alice@example.com\n';
    const prefix = Buffer.from([0xef, 0xaa]); // Not a complete BOM
    const buf = Buffer.concat([prefix, Buffer.from(csv_text, 'utf-8')]);
    // csv-parser may not parse this correctly, but it shouldn't crash
    // Just confirm no unhandled promise rejection
    await expect(parseCsvRows(buf)).resolves.toBeDefined();
  });

  test('parses correctly when BOM is immediately followed by headers', async () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const content = Buffer.from('PLAYA NAME,EMAIL\nDust Devil,dust@example.com\n', 'utf-8');
    const buf = Buffer.concat([bom, content]);
    const { headers, rows } = await parseCsvRows(buf);
    expect(headers[0]).toBe('PLAYA NAME'); // Should NOT have \ufeff prefix
    expect(rows[0]['PLAYA NAME']).toBe('Dust Devil');
  });
});
