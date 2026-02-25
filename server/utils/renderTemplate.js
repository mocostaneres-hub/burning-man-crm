const ALLOWED_TEMPLATE_VARIABLES = new Set([
  'member_name',
  'camp_name',
  'dues_amount',
  'due_date',
  'payment_link',
  'payment_date'
]);

function renderTemplate(template, variables = {}) {
  const normalizedTemplate = typeof template === 'string' ? template : '';
  return normalizedTemplate.replace(/{{(.*?)}}/g, (_, rawKey) => {
    const key = String(rawKey || '').trim();
    if (!ALLOWED_TEMPLATE_VARIABLES.has(key)) {
      return '';
    }
    const value = variables[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

module.exports = {
  ALLOWED_TEMPLATE_VARIABLES,
  renderTemplate
};
