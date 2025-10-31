// Test script for welcome email functionality
require('dotenv').config();
const { sendWelcomeEmail } = require('./server/services/emailService');

// Test data for personal account
const testPersonalUser = {
  email: process.env.TEST_EMAIL || 'mudskipperscafe@gmail.com',
  firstName: 'Mo',
  lastName: 'Costa-Neres',
  accountType: 'personal'
};

// Test data for camp account
const testCampUser = {
  email: process.env.TEST_EMAIL || 'mudskipperscafe@gmail.com',
  campName: 'Test Camp',
  accountType: 'camp'
};

async function testWelcomeEmails() {
  console.log('🧪 Testing Welcome Email Functionality\n');
  console.log('=' .repeat(60));
  
  // Check if SendGrid is configured
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY not found in environment variables');
    console.log('\nPlease configure SendGrid before testing:');
    console.log('1. Set SENDGRID_API_KEY in your .env file');
    console.log('2. Set SENDGRID_FROM_EMAIL (default: noreply@g8road.com)');
    console.log('3. Set SENDGRID_FROM_NAME (default: G8Road)');
    process.exit(1);
  }

  console.log('✅ SendGrid API Key: Found');
  console.log(`📧 From Email: ${process.env.SENDGRID_FROM_EMAIL || 'noreply@g8road.com'}`);
  console.log(`👤 From Name: ${process.env.SENDGRID_FROM_NAME || 'G8Road'}`);
  console.log(`🎯 Test Email: ${testPersonalUser.email}\n`);
  console.log('=' .repeat(60));

  try {
    // Test 1: Personal Account Welcome Email
    console.log('\n📨 Test 1: Sending welcome email to PERSONAL account...');
    console.log(`   Email: ${testPersonalUser.email}`);
    console.log(`   Name: ${testPersonalUser.firstName} ${testPersonalUser.lastName}`);
    
    await sendWelcomeEmail(testPersonalUser);
    console.log('✅ Personal account welcome email sent successfully!\n');

    // Wait a bit to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Camp Account Welcome Email
    console.log('📨 Test 2: Sending welcome email to CAMP account...');
    console.log(`   Email: ${testCampUser.email}`);
    console.log(`   Camp Name: ${testCampUser.campName}`);
    
    await sendWelcomeEmail(testCampUser);
    console.log('✅ Camp account welcome email sent successfully!\n');

    console.log('=' .repeat(60));
    console.log('\n🎉 All tests passed successfully!');
    console.log('\n📬 Check your email inbox for:');
    console.log('   1. Welcome email for personal account');
    console.log('   2. Welcome email for camp account\n');
    console.log('💡 Tips:');
    console.log('   - Check spam folder if you don\'t see the emails');
    console.log('   - Verify sender authentication in SendGrid dashboard');
    console.log('   - Review email templates in server/services/emailService.js\n');

  } catch (error) {
    console.error('\n❌ Error sending welcome email:', error.message);
    
    if (error.response) {
      console.error('\n📋 SendGrid Error Details:');
      console.error(JSON.stringify(error.response.body, null, 2));
    }

    console.log('\n🔍 Troubleshooting:');
    console.log('1. Verify SENDGRID_API_KEY is correct');
    console.log('2. Check sender email is verified in SendGrid');
    console.log('3. Review SendGrid dashboard for delivery issues');
    console.log('4. Ensure you\'re not hitting rate limits\n');
    
    process.exit(1);
  }
}

// Run the tests
console.log('\n🚀 Starting Welcome Email Tests...\n');
testWelcomeEmails().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

