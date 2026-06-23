const SYSTEM_DEFAULT_MEAL_PLAN_TEMPLATES = {
  instructions: {
    subject: 'Meal Plan Payment Instructions for {{camp_name}}',
    body: `Hi {{member_name}},

You are marked as enrolled in the {{camp_name}} meal plan.

To confirm your meal plan spot, please submit your meal plan payment.

Amount Due: {{meal_plan_amount}}
Due Date: {{due_date}}

Payment Instructions:
{{payment_link}}

If you have questions, reply directly to this email.

{{camp_name}} Team`
  },
  receipt: {
    subject: 'Meal Plan Payment Received - {{camp_name}}',
    body: `Hi {{member_name}},

We've received your meal plan payment for {{camp_name}}.

Amount: {{meal_plan_amount}}
Date Received: {{payment_date}}

Thank you. Your meal plan payment is recorded.

If this was sent in error, please contact us.

{{camp_name}} Team`
  }
};

function getCampMealPlanTemplate(camp, templateType) {
  if (templateType === 'instructions') {
    return {
      subject: camp?.mealPlanInstructionsSubject || SYSTEM_DEFAULT_MEAL_PLAN_TEMPLATES.instructions.subject,
      body: camp?.mealPlanInstructionsBody || SYSTEM_DEFAULT_MEAL_PLAN_TEMPLATES.instructions.body
    };
  }

  return {
    subject: camp?.mealPlanReceiptSubject || SYSTEM_DEFAULT_MEAL_PLAN_TEMPLATES.receipt.subject,
    body: camp?.mealPlanReceiptBody || SYSTEM_DEFAULT_MEAL_PLAN_TEMPLATES.receipt.body
  };
}

module.exports = {
  SYSTEM_DEFAULT_MEAL_PLAN_TEMPLATES,
  getCampMealPlanTemplate
};
