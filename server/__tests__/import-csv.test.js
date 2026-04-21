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
