const SYSTEM_DEFAULT_TEMPLATES = {
  instructions: {
    subject: 'Payment Instructions for {{camp_name}} Dues',
    body: `Hi {{member_name}},

You’ve been activated as a member of {{camp_name}}.

To complete your membership, please submit your camp dues.

Amount Due: {{dues_amount}}
Due Date: {{due_date}}

Payment Instructions:
{{payment_link}}

If you have questions, reply directly to this email.

{{camp_name}} Team`
  },
  receipt: {
    subject: 'Payment Received - {{camp_name}}',
    body: `Hi {{member_name}},

We’ve received your camp dues payment for {{camp_name}}.

Amount: {{dues_amount}}
Date Received: {{payment_date}}

Thank you for contributing to camp. We’re excited to have you with us.

If this was sent in error, please contact us.

{{camp_name}} Team`
  }
};

function getCampTemplate(camp, templateType) {
  if (templateType === 'instructions') {
    return {
      subject: camp?.duesInstructionsSubject || SYSTEM_DEFAULT_TEMPLATES.instructions.subject,
      body: camp?.duesInstructionsBody || SYSTEM_DEFAULT_TEMPLATES.instructions.body
    };
  }

  return {
    subject: camp?.duesReceiptSubject || SYSTEM_DEFAULT_TEMPLATES.receipt.subject,
    body: camp?.duesReceiptBody || SYSTEM_DEFAULT_TEMPLATES.receipt.body
  };
}

module.exports = {
  SYSTEM_DEFAULT_TEMPLATES,
  getCampTemplate
};
