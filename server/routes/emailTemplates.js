const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const EmailTemplate = require('../models/EmailTemplate');
const {
  ensureDefaultTemplates,
  DEFAULT_TEMPLATE_DATA,
  renderTemplateString
} = require('../services/emailTemplateService');

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureDefaultTemplates();
    const templates = await EmailTemplate.find({}).sort({ key: 1 }).lean();
    res.json({ templates });
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put(
  '/:key',
  authenticateToken,
  requireAdmin,
  [
    body('subject').isString().notEmpty(),
    body('htmlContent').isString().notEmpty(),
    body('textContent').optional().isString(),
    body('variables').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { key } = req.params;
      const defaults = DEFAULT_TEMPLATE_DATA[key];
      if (!defaults) {
        return res.status(404).json({ message: 'Unknown template key' });
      }

      const update = {
        name: defaults.name,
        description: defaults.description,
        subject: req.body.subject,
        htmlContent: req.body.htmlContent,
        textContent: req.body.textContent || '',
        variables: Array.isArray(req.body.variables) ? req.body.variables : defaults.variables,
        isActive: req.body.isActive !== false,
        updatedBy: req.user._id
      };

      const template = await EmailTemplate.findOneAndUpdate(
        { key },
        { $set: update, $setOnInsert: { key } },
        { upsert: true, new: true }
      );

      res.json({ template });
    } catch (error) {
      console.error('Update email template error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.post('/:key/preview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const template = await EmailTemplate.findOne({ key }).lean();
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    const sampleData = req.body?.data || {};
    res.json({
      subject: renderTemplateString(template.subject, sampleData),
      htmlContent: renderTemplateString(template.htmlContent, sampleData),
      textContent: renderTemplateString(template.textContent || '', sampleData)
    });
  } catch (error) {
    console.error('Preview email template error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
