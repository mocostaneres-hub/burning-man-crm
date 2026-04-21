/**
 * Drops legacy Member indexes that are not declared in the current schema,
 * then re-syncs the collection's indexes to match the Mongoose model.
 *
 * Why this exists:
 *   MongoDB never drops indexes automatically when a Mongoose schema changes.
 *   If an earlier version of the Member schema declared a unique index (e.g.
 *   a plain { email: 1 } unique, or any other compound that has since been
 *   removed) and that index is still present in MongoDB, INSERTs can fail
 *   with E11000 errors whose keyPattern doesn't match any current schema
 *   constraint — producing phantom duplicate-key errors (e.g. rejecting two
 *   members with DIFFERENT emails because of a stale index on user or phone).
 *
 * This routine runs once at startup, is idempotent, and is safe to re-run.
 * It will NEVER drop the default `_id_` index.
 */
const mongoose = require('mongoose');

const DECLARED_SCHEMA_INDEXES = [
  // These MUST match the indexes declared in server/models/Member.js
  { key: { camp: 1, user: 1 }, unique: true, partial: { user: { $exists: true, $ne: null } } },
  { key: { camp: 1, email: 1 }, unique: true, partial: { email: { $exists: true, $ne: null } } },
  { key: { camp: 1, role: 1 } },
  { key: { camp: 1, status: 1 } },
  { key: { user: 1 } }
];

function keyEquals(a, b) {
  const ak = Object.keys(a || {});
  const bk = Object.keys(b || {});
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

async function syncMemberIndexes() {
  try {
    const Member = require('../models/Member');
    const collection = Member.collection;

    const existing = await collection.indexes();
    const stale = [];

    for (const idx of existing) {
      if (idx.name === '_id_') continue;
      const declared = DECLARED_SCHEMA_INDEXES.find((d) => keyEquals(d.key, idx.key));
      if (!declared) {
        stale.push(idx);
      }
    }

    if (stale.length > 0) {
      console.warn(
        `⚠️  [syncMemberIndexes] Found ${stale.length} legacy Member index(es) not in the current schema:`,
        stale.map((i) => ({ name: i.name, key: i.key, unique: i.unique }))
      );
      for (const idx of stale) {
        try {
          await collection.dropIndex(idx.name);
          console.log(`✅ [syncMemberIndexes] Dropped legacy index ${idx.name}`);
        } catch (dropErr) {
          console.error(
            `❌ [syncMemberIndexes] Failed to drop ${idx.name}:`,
            dropErr?.message
          );
        }
      }
    } else {
      console.log('✅ [syncMemberIndexes] No legacy Member indexes detected');
    }

    // Re-sync to guarantee all declared indexes exist.
    await Member.syncIndexes();
    console.log('✅ [syncMemberIndexes] Member indexes fully synced');
  } catch (err) {
    console.error('❌ [syncMemberIndexes] Failed:', err?.message);
  }
}

module.exports = { syncMemberIndexes };
