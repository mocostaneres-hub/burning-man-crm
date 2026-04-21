const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const csv = require('csv-parser');
const { PassThrough } = require('stream');
const Member = require('../models/Member');
const Camp = require('../models/Camp');
const db = require('../database/databaseAdapter');
const { recordActivity } = require('../services/activityLogger');
const { authenticateToken, requireCampMember, requireProjectLead } = require('../middleware/auth');
const { getUserCampId, canAccessCamp, canManageCamp } = require('../utils/permissionHelpers');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const normalizeCsvEmail = (value = '') => String(value || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const resolveCsvCampId = async (req) => {
  const requestedCampId = req.body?.campId || req.query?.campId;
  if (requestedCampId) {
    const hasAccess = await canManageCamp(req, requestedCampId);
    return hasAccess ? requestedCampId : null;
  }
  if (req.user.accountType === 'camp' || (req.user.accountType === 'admin' && req.user.campId)) {
    return getUserCampId(req);
  }
  if (req.user.isCampLead && req.user.campLeadCampId) {
    const hasAccess = await canManageCamp(req, req.user.campLeadCampId);
    return hasAccess ? req.user.campLeadCampId : null;
  }
  return null;
};

const parseCsvRows = async (fileBuffer) => {
  const rows = [];
  const headers = [];

  // Strip UTF-8 BOM (\xEF\xBB\xBF) that Excel often prepends to CSV exports.
  // Without this the first column header contains the BOM character, breaking
  // all column-mapping logic silently.
  let buf = fileBuffer;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    buf = buf.slice(3);
    console.log('ℹ️ [import-csv] Stripped UTF-8 BOM from CSV buffer');
  }

  await new Promise((resolve, reject) => {
    const stream = new PassThrough();
    stream.end(buf);
    stream
      .pipe(csv())
      .on('headers', (h) => headers.push(...h))
      .on('data', (data) => rows.push(data))
      .on('end', resolve)
      .on('error', (err) => {
        console.error('❌ [import-csv] csv-parser stream error:', err?.message);
        reject(err);
      });
  });
  return { rows, headers };
};

// @route   POST /api/members/apply
// @desc    Apply to join a camp
// @access  Private (Personal accounts only)
router.post('/apply', authenticateToken, [
  body('campId').isMongoId(),
  body('applicationData').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user has personal account
    if (req.user.accountType !== 'personal') {
      return res.status(403).json({ message: 'Only personal accounts can apply to camps' });
    }

    const { campId, applicationData } = req.body;
    const db = require('../database/databaseAdapter');

    // Check if camp exists and is recruiting
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    if (!camp.isRecruiting) {
      return res.status(400).json({ message: 'Camp is not currently recruiting' });
    }

    // Check if user already applied
    const existingApplication = await db.findMember({ 
      user: req.user._id, 
      camp: campId 
    });

    if (existingApplication) {
      return res.status(400).json({ message: 'Already applied to this camp' });
    }

    // Create application
    const memberData = {
      camp: campId,
      user: req.user._id,
      applicationData,
      status: camp.settings?.autoApprove ? 'active' : 'pending'
    };

    const member = await db.createMember(memberData);

    // Update camp stats
    if (camp.stats) {
      camp.stats.totalApplications += 1;
    } else {
      camp.stats = { totalApplications: 1 };
    }
    await db.updateCamp(camp._id, { stats: camp.stats });

    res.status(201).json({
      message: 'Application submitted successfully',
      member
    });

  } catch (error) {
    console.error('Apply to camp error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/members/my-applications
// @desc    Get user's applications
// @access  Private
router.get('/my-applications', authenticateToken, async (req, res) => {
  try {
    const db = require('../database/databaseAdapter');
    const members = await db.findManyMembers({ user: req.user._id });
    
    // Populate camp data for each member
    const applications = await Promise.all(members.map(async (member) => {
      const camp = await db.findCamp({ _id: member.camp });
      return {
        ...member,
        camp: camp ? {
          _id: camp._id,
          name: camp.name,
          description: camp.description,
          theme: camp.theme,
          photos: camp.photos
        } : null
      };
    }));

    res.json({ applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/members/:id/approve
// @desc    Approve or reject member application
// @access  Private (Camp lead or project lead)
router.put('/:id/approve', authenticateToken, [
  body('status').isIn(['active', 'rejected']),
  body('reviewNotes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, reviewNotes } = req.body;

    const member = await Member.findById(req.params.id).populate('camp');
    if (!member) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check permissions
    // Check camp ownership using helper
    const isCampLead = await canAccessCamp(req, member.camp._id);
    const userMember = await Member.findOne({ 
      user: req.user._id, 
      camp: member.camp._id,
      role: { $in: ['camp-lead', 'project-lead'] },
      status: 'active'
    });

    if (!isCampLead && !userMember) {
      return res.status(403).json({ message: 'Not authorized to approve applications' });
    }

    // Update member status
    member.status = status;
    member.reviewedAt = new Date();
    member.reviewedBy = req.user._id;
    member.reviewNotes = reviewNotes;

    await member.save();

    // Update camp stats
    if (status === 'active') {
      member.camp.stats.totalMembers += 1;
      member.camp.stats.acceptanceRate = 
        (member.camp.stats.totalMembers / member.camp.stats.totalApplications) * 100;
    }
    await member.camp.save();

    res.json({
      message: `Application ${status} successfully`,
      member
    });

  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/members/:id/role
// @desc    Change member role
// @access  Private (Camp lead only)
router.put('/:id/role', authenticateToken, [
  body('newRole').isIn(['member', 'project-lead', 'camp-lead']),
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { newRole, reason } = req.body;

    const member = await Member.findById(req.params.id).populate('camp');
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check if user is camp lead
    // Check camp ownership using helper
    const hasAccess = await canAccessCamp(req, member.camp._id);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Only camp leads can change roles' });
    }

    const oldRole = member.role;

    // Add to role history
    member.roleHistory.push({
      fromRole: oldRole,
      toRole: newRole,
      changedBy: req.user._id,
      reason,
      status: 'approved'
    });

    // Update role
    member.role = newRole;
    await member.save();

    res.json({
      message: 'Role updated successfully',
      member
    });

  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/members/:id/status
// @desc    Update member status (activate, deactivate, suspend)
// @access  Private (Camp lead or project lead)
router.put('/:id/status', authenticateToken, [
  body('status').isIn(['active', 'inactive', 'suspended']),
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, reason } = req.body;

    const member = await Member.findById(req.params.id).populate('camp');
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check permissions
    // Check camp ownership using helper
    const isCampLead = await canAccessCamp(req, member.camp._id);
    const userMember = await Member.findOne({ 
      user: req.user._id, 
      camp: member.camp._id,
      role: { $in: ['camp-lead', 'project-lead'] },
      status: 'active'
    });

    if (!isCampLead && !userMember) {
      return res.status(403).json({ message: 'Not authorized to change member status' });
    }

    // Add note if reason provided
    if (reason) {
      member.notes.push({
        content: `Status changed to ${status}: ${reason}`,
        addedBy: req.user._id,
        isPrivate: true
      });
    }

    member.status = status;
    await member.save();

    res.json({
      message: 'Member status updated successfully',
      member
    });

  } catch (error) {
    console.error('Update member status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/members/:id/contributions
// @desc    Add contribution for member
// @access  Private (Camp lead or project lead)
router.post('/:id/contributions', authenticateToken, [
  body('type').isIn(['work-shift', 'resource', 'skill', 'financial', 'other']),
  body('title').trim().isLength({ min: 1 }),
  body('date').isISO8601(),
  body('hours').optional().isNumeric(),
  body('value').optional().isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const member = await Member.findById(req.params.id).populate('camp');
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check permissions
    // Check camp ownership using helper
    const isCampLead = await canAccessCamp(req, member.camp._id);
    const userMember = await Member.findOne({ 
      user: req.user._id, 
      camp: member.camp._id,
      role: { $in: ['camp-lead', 'project-lead'] },
      status: 'active'
    });

    if (!isCampLead && !userMember) {
      return res.status(403).json({ message: 'Not authorized to add contributions' });
    }

    const contribution = {
      ...req.body,
      date: new Date(req.body.date),
      status: 'completed'
    };

    member.contributions.push(contribution);
    await member.save();

    res.status(201).json({
      message: 'Contribution added successfully',
      contribution: member.contributions[member.contributions.length - 1]
    });

  } catch (error) {
    console.error('Add contribution error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/members/:id
// @desc    Get member details
// @access  Private (Camp members only)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id)
      .populate('user', 'firstName lastName email profilePhoto accountType playaName')
      .populate('camp', 'name');

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check if user has access to this member
    const userMember = await Member.findOne({ 
      user: req.user._id, 
      camp: member.camp._id,
      status: 'active'
    });

    if (!userMember) {
      return res.status(403).json({ message: 'Not authorized to view this member' });
    }

    res.json({ member });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Multer error handler — converts file-upload errors to proper 400 responses.
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ [import-csv] Multer/upload error:', err?.message);
      return res.status(400).json({ message: `File upload error: ${err?.message || 'Unknown upload error'}` });
    }
    next();
  });
};

// @route   POST /api/members/import-csv
// @desc    Import shifts-only roster members from CSV (add-only, preview/confirm)
// @access  Private (Camp admins and Camp Leads)
router.post('/import-csv', authenticateToken, handleUpload, async (req, res) => {
  try {
    const campId = await resolveCsvCampId(req);
    if (!campId) {
      return res.status(403).json({ message: 'Camp admin or Camp Lead access required' });
    }
    const camp = await Camp.findById(campId).select('rosterCustomFields');
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const activeRoster = await db.findActiveRoster({ camp: campId });
    if (activeRoster?.rosterType === 'full_membership') {
      return res.status(409).json({
        message: 'Shifts-only CSV import is unavailable while a full-membership roster is active. Archive the current roster first.'
      });
    }

    const confirmImport = String(req.body?.confirm || '').toLowerCase() === 'true';
    const mappingRaw = req.body?.mapping;
    let mapping = {};
    if (mappingRaw) {
      try {
        mapping = typeof mappingRaw === 'string' ? JSON.parse(mappingRaw) : mappingRaw;
      } catch (_e) {
        return res.status(400).json({ message: 'Invalid mapping payload' });
      }
    }

    const { rows: rawRows, headers: rawHeaders } = await parseCsvRows(req.file.buffer);

    // ── TRACE A: raw parse result ────────────────────────────────────────────
    console.log('[CSV-TRACE A] raw parse', {
      rawHeaderCount: rawHeaders.length,
      rawHeaders,
      rawRowCount: rawRows.length,
      sampleRawRow: rawRows[0] ?? null,
    });

    // Normalize every header key: trim → lowercase → spaces→underscores.
    // This makes the import pipeline completely case-insensitive:
    //   "NAME"       → "name"
    //   "PLAYA NAME" → "playa_name"
    //   "EMAIL"      → "email"
    // Normalization happens once here so all downstream code sees clean keys.
    const normalizeKey = (h) => String(h || '').trim().toLowerCase().replace(/\s+/g, '_');

    const headers = rawHeaders.map(normalizeKey);
    const rows = rawRows.map((rawRow) => {
      const normalized = {};
      for (const [k, v] of Object.entries(rawRow)) {
        normalized[normalizeKey(k)] = v;
      }
      return normalized;
    });

    // Also normalize mapping VALUES so that a frontend mapping like
    // { name: "NAME" } correctly resolves to the normalized key "name".
    const normalizedMapping = {};
    for (const [field, csvCol] of Object.entries(mapping)) {
      normalizedMapping[field] = csvCol ? normalizeKey(csvCol) : '';
    }

    // Resolve a canonical field from a normalized row.
    // Priority: explicit mapping → lowercase fallback that matches the normalized key.
    const getColumn = (row, canonical, fallback) => {
      const mapped = normalizedMapping?.[canonical];
      const key = mapped || fallback;
      return row?.[key] ?? '';
    };

    // ── TRACE B: post-normalization state ────────────────────────────────────
    console.log('[CSV-TRACE B] after normalization', {
      normalizedHeaders: headers,
      normalizedRowCount: rows.length,
      sampleNormalizedRow: rows[0] ?? null,
      normalizedMapping,
    });

    const seenCsvEmails = new Set();
    const validCandidates = [];
    const invalidRows = [];
    const skippedRows = [];
    const preview = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const name = String(getColumn(row, 'name', 'name')).trim();
      const email = normalizeCsvEmail(getColumn(row, 'email', 'email'));
      const phone = String(getColumn(row, 'phone', 'phone')).trim();
      const role = String(getColumn(row, 'role', 'role')).trim();
      const playaName = String(getColumn(row, 'playa_name', 'playa_name')).trim();
      const tagsRaw = String(getColumn(row, 'tags', 'tags')).trim();
      const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];
      const customFieldValues = {};
      for (const field of camp.rosterCustomFields || []) {
        const mappedColumn = normalizedMapping?.[`cf_${field.key}`];
        if (!mappedColumn) continue;
        const rawValue = row?.[mappedColumn];
        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') continue;
        if (field.type === 'number') {
          const asNum = Number(rawValue);
          if (!Number.isNaN(asNum)) customFieldValues[field.key] = asNum;
        } else if (field.type === 'checkbox') {
          const valueStr = String(rawValue).trim().toLowerCase();
          customFieldValues[field.key] = ['true', 'yes', '1', 'on'].includes(valueStr);
        } else if (field.type === 'dropdown' || field.type === 'text') {
          customFieldValues[field.key] = String(rawValue).trim();
        }
      }

      const rowNumber = i + 2; // include header row

      // ── TRACE C: per-row validation ────────────────────────────────────────
      const rowErrors = [];
      if (!name)            rowErrors.push('name_empty');
      if (!email)           rowErrors.push('email_empty');
      if (email && !isValidEmail(email)) rowErrors.push('email_invalid');
      if (seenCsvEmails.has(email))      rowErrors.push('duplicate_in_csv');
      console.log(`[CSV-TRACE C] row ${rowNumber}`, {
        rawRow: rows[i],
        name, email, playaName,
        valid: rowErrors.length === 0,
        errors: rowErrors,
      });

      if (!name || !email) {
        invalidRows.push({ row: rowNumber, reason: 'missing_required_fields', name, email });
        continue;
      }
      if (!isValidEmail(email)) {
        invalidRows.push({ row: rowNumber, reason: 'invalid_email', name, email });
        continue;
      }
      if (seenCsvEmails.has(email)) {
        skippedRows.push({ row: rowNumber, reason: 'duplicate_in_csv', name, email });
        continue;
      }
      seenCsvEmails.add(email);

      validCandidates.push({
        name,
        email,
        phone,
        role: role || 'member',
        playaName,
        tags,
        customFieldValues
      });
    }

    // ── TRACE D: post-validation summary ────────────────────────────────────
    console.log('[CSV-TRACE D] validation complete', {
      parsedRowCount: rows.length,
      validCandidateCount: validCandidates.length,
      invalidRowCount: invalidRows.length,
      invalidRows,
      skippedRowCount: skippedRows.length,
    });

    const existing = await Member.find({
      camp: campId,
      email: { $in: validCandidates.map((c) => c.email) }
    }).select('email');
    const existingEmailSet = new Set((existing || []).map((m) => normalizeCsvEmail(m.email)));

    // ── TRACE E: DB duplicate check ──────────────────────────────────────────
    console.log('[CSV-TRACE E] DB duplicate check', {
      queriedEmails: validCandidates.map((c) => c.email),
      existingInDB: [...existingEmailSet],
    });

    // Split valid candidates: new emails → insert, existing emails → update.
    // We never skip — existing members get their CSV fields refreshed instead.
    const toCreate = [];
    const toUpdate = [];
    for (const candidate of validCandidates) {
      if (existingEmailSet.has(candidate.email)) {
        toUpdate.push(candidate);
      } else {
        toCreate.push(candidate);
      }
    }

    // ── TRACE F: pre-write summary ────────────────────────────────────────────
    console.log('[CSV-TRACE F] pre-write', {
      toCreateCount: toCreate.length,
      toUpdateCount: toUpdate.length,
      toCreateEmails: toCreate.map((c) => c.email),
      toUpdateEmails: toUpdate.map((c) => c.email),
    });

    // Preview shows first 10 across both buckets (creates first, then updates).
    for (const item of [...toCreate, ...toUpdate].slice(0, 10)) {
      preview.push({
        name: item.name,
        email: item.email,
        phone: item.phone || '',
        role: item.role || 'member',
        playaName: item.playaName || '',
        tags: item.tags || [],
        customFieldValues: item.customFieldValues || {},
        _action: existingEmailSet.has(item.email) ? 'update' : 'create',
      });
    }

    console.log(`ℹ️ [import-csv] Parsed ${rows.length} rows — valid=${validCandidates.length} invalid=${invalidRows.length} skipped=${skippedRows.length}`);
    console.log(`ℹ️ [import-csv] Normalized headers:`, headers);

    if (!confirmImport) {
      return res.json({
        mode: 'preview',
        headers,
        preview,
        summary: {
          totalRows: rows.length,
          validRows: validCandidates.length,
          toCreate: toCreate.length,
          toUpdate: toUpdate.length,
          invalid: invalidRows.length,
          skipped: skippedRows.length
        },
        invalidRows: invalidRows.slice(0, 100),
        skippedRows: skippedRows.slice(0, 100)
      });
    }

    if (toCreate.length === 0 && toUpdate.length === 0) {
      const allFailed = invalidRows.length > 0 && validCandidates.length === 0;
      return res.json({
        mode: 'confirm',
        message: allFailed
          ? `No members could be imported — ${invalidRows.length} row(s) failed validation. Check that your CSV has "name" and "email" columns with valid values.`
          : 'No valid members found in CSV',
        createdCount: 0,
        updatedCount: 0,
        skippedCount: skippedRows.length,
        invalidCount: invalidRows.length,
        invalidRows: allFailed ? invalidRows.slice(0, 20) : undefined,
        normalizedHeaders: allFailed ? headers : undefined
      });
    }

    // ── Step 1a: insert new members ──────────────────────────────────────────
    const insertDocs = toCreate.map((item) => ({
      camp: campId,
      name: item.name,
      email: item.email,
      phone: item.phone || '',
      playaName: item.playaName || '',
      role: item.role === 'lead' ? 'camp-lead' : 'member',
      tags: item.tags || [],
      customFieldValues: item.customFieldValues || {},
      status: 'roster_only',
      isShiftsOnly: true,
      signupSource: 'shifts_only_invite'
    }));

    console.log('[CSV-TRACE G] insert payload', {
      docCount: insertDocs.length,
      docs: insertDocs.map((d) => ({ email: d.email, name: d.name })),
    });
    console.log(`ℹ️ [import-csv] Step 1a — inserting ${insertDocs.length} new member docs`);

    let createdCount = 0;
    let duplicateInsertConflicts = 0;

    if (insertDocs.length > 0) {
      try {
        const created = await Member.insertMany(insertDocs, { ordered: false });
        createdCount = created.length;
        console.log('[CSV-TRACE H] insertMany succeeded', { createdCount, ids: created.map((d) => d._id) });
        console.log(`✅ [import-csv] Step 1a — inserted ${createdCount} members`);
      } catch (insertError) {
        const writeErrors = Array.isArray(insertError?.writeErrors) ? insertError.writeErrors : [];
        const isDuplicateOnlyError = writeErrors.length > 0 &&
          writeErrors.every((e) => e?.code === 11000 || e?.code === 11001);

        if (!isDuplicateOnlyError && writeErrors.length === 0) {
          console.error('❌ [import-csv] Step 1a — insertMany non-bulk error:', {
            name: insertError?.name, message: insertError?.message, code: insertError?.code,
          });
        } else if (!isDuplicateOnlyError) {
          const nonDupErrors = writeErrors.filter((e) => e?.code !== 11000 && e?.code !== 11001);
          console.error('❌ [import-csv] Step 1a — non-duplicate write errors:', nonDupErrors.map((e) => ({ code: e?.code, msg: e?.errmsg })));
        }

        duplicateInsertConflicts = writeErrors.filter((e) => e?.code === 11000 || e?.code === 11001).length;
        createdCount =
          insertError?.result?.insertedCount ??
          insertError?.result?.result?.nInserted ??
          insertError?.result?.nInserted ??
          (Array.isArray(insertError?.insertedDocs) ? insertError.insertedDocs.length : 0);

        console.log('[CSV-TRACE I] insertMany catch', {
          errorName: insertError?.name, errorMessage: insertError?.message,
          writeErrorCount: writeErrors.length, createdCount, duplicateInsertConflicts,
        });
      }
    }

    // ── Step 1b: update existing members ────────────────────────────────────
    // Refreshes name, phone, playaName, tags, role, and customFieldValues from
    // the CSV. Does NOT touch status, user reference, or signupSource.
    console.log(`ℹ️ [import-csv] Step 1b — updating ${toUpdate.length} existing members`);
    let updatedCount = 0;

    if (toUpdate.length > 0) {
      const bulkUpdateOps = toUpdate.map((item) => ({
        updateOne: {
          filter: { camp: campId, email: item.email },
          update: {
            $set: {
              name: item.name,
              phone: item.phone || '',
              playaName: item.playaName || '',
              tags: item.tags || [],
              role: item.role === 'lead' ? 'camp-lead' : 'member',
              customFieldValues: item.customFieldValues || {},
              isShiftsOnly: true,
            },
          },
        },
      }));

      try {
        const updateResult = await Member.bulkWrite(bulkUpdateOps, { ordered: false });
        updatedCount = updateResult.modifiedCount ?? 0;
        console.log(`✅ [import-csv] Step 1b — updated ${updatedCount} members (matched=${updateResult.matchedCount})`);
      } catch (updateError) {
        console.error('❌ [import-csv] Step 1b — bulkWrite error:', updateError?.message);
        // Non-fatal: log and continue so the insert results aren't lost.
      }
    }

    // ── TRACE J: critical guard ──────────────────────────────────────────────
    if (insertDocs.length > 0 && createdCount === 0) {
      console.error('[CSV-TRACE J] ⚠️ CRITICAL — docs submitted but createdCount=0', {
        insertDocCount: insertDocs.length, insertEmails: insertDocs.map((d) => d.email),
        existingInDB: [...existingEmailSet],
      });
    }

    const totalAffected = createdCount + updatedCount;

    // ── Step 2: create / fetch roster ────────────────────────────────────────
    if (totalAffected > 0) {
      console.log(`ℹ️ [import-csv] Step 2 — resolving roster for ${createdCount} new members`);
      let rosterForImport = activeRoster;

      if (!rosterForImport?._id) {
        try {
          rosterForImport = await db.createRoster({
            camp: campId,
            name: `${new Date().getFullYear()} Roster`,
            description: 'Active shifts-only roster',
            rosterType: 'shifts_only',
            isActive: true,
            createdBy: req.user._id
          });
          console.log(`✅ [import-csv] Step 2 — roster created: ${rosterForImport?._id}`);
        } catch (rosterCreateErr) {
          // Recovery for any error: if a roster already exists (race condition, stale
          // isArchived field, or any other duplicate/conflict), re-fetch it rather
          // than surfacing a 500. We only propagate if the fetch also fails.
          console.warn(`⚠️ [import-csv] Step 2 — createRoster failed (code=${rosterCreateErr?.code}), attempting recovery fetch:`, rosterCreateErr?.message);
          try {
            rosterForImport = await db.findActiveRoster({ camp: campId });
            if (rosterForImport?._id) {
              console.log(`✅ [import-csv] Step 2 — recovered existing roster: ${rosterForImport._id}`);
            } else {
              console.error('❌ [import-csv] Step 2 — recovery fetch found no active roster; members were inserted but will not be linked to a roster');
            }
          } catch (fetchErr) {
            console.error('❌ [import-csv] Step 2 — roster recovery fetch also failed:', fetchErr?.message);
            // Continue without a roster rather than returning 500 — members were inserted.
            rosterForImport = null;
          }
        }
      }

      // ── Step 3: link members to the roster ───────────────────────────────
      if (rosterForImport?._id) {
        console.log(`ℹ️ [import-csv] Step 3 — linking members to roster ${rosterForImport._id}`);
        // Include both newly created AND updated members so all of them end up
        // on the roster regardless of whether they were new or already existed.
        const importedEmails = [...toCreate, ...toUpdate].map((item) => item.email).filter(Boolean);
        if (importedEmails.length > 0) {
          let importedMembers = [];
          try {
            importedMembers = await Member.find({
              camp: campId,
              email: { $in: importedEmails }
            }).select('_id');
          } catch (findErr) {
            console.error('❌ [import-csv] Step 3 — Member.find failed:', findErr?.message);
          }

          let linkedCount = 0;
          let linkErrorCount = 0;
          for (const importedMember of importedMembers) {
            try {
              await db.addMemberToRoster(rosterForImport._id, importedMember._id, req.user._id);
              linkedCount += 1;
            } catch (linkErr) {
              linkErrorCount += 1;
              console.error(`❌ [import-csv] Step 3 — addMemberToRoster failed for member ${importedMember._id}:`, linkErr?.message);
            }
          }
          console.log(`✅ [import-csv] Step 3 — linked ${linkedCount} members (${linkErrorCount} errors)`);
        }
      }
    }

    // ── Step 4: activity log ────────────────────────────────────────────────
    await recordActivity('CAMP', campId, req.user._id, 'DATA_ACTION', {
      field: 'rosterImport',
      action: 'import_csv',
      createdCount,
      updatedCount,
      skippedCount: skippedRows.length,
      invalidCount: invalidRows.length,
      isShiftsOnlyCamp: true
    });
    console.log(`✅ [import-csv] Done — created=${createdCount} updated=${updatedCount} invalid=${invalidRows.length}`);
    return res.json({
      mode: 'confirm',
      message: 'CSV import completed',
      createdCount,
      updatedCount,
      skippedCount: skippedRows.length,
      invalidCount: invalidRows.length,
      duplicateInsertConflicts
    });
  } catch (error) {
    console.error('❌ [import-csv] Unhandled error:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack?.split('\n').slice(0, 5).join(' | ')
    });
    return res.status(500).json({ message: 'Failed to import CSV roster', detail: error?.message });
  }
});

module.exports = router;
