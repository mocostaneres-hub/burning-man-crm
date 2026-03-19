const { runOnboardingReminderPass } = require('../services/onboardingReminderService');

const ONE_HOUR_MS = 60 * 60 * 1000;

let reminderInterval = null;

async function tick() {
  try {
    await runOnboardingReminderPass();
  } catch (error) {
    console.error('❌ [OnboardingReminderWorker] Tick failed:', error.message);
  }
}

function startOnboardingReminderWorker() {
  if (reminderInterval) return;
  reminderInterval = setInterval(tick, ONE_HOUR_MS);
  tick(); // run once on startup
  console.log('✅ [OnboardingReminderWorker] Started (hourly)');
}

module.exports = {
  startOnboardingReminderWorker
};
