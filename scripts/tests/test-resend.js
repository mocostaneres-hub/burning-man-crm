// Test Resend Email Integration
require('dotenv').config();
const { sendTestEmail } = require('../../server/services/emailService');

const testEmail = process.argv[2] || 'test@example.com';

console.log('🧪 Testing Resend Email Integration...');
console.log('📧 Sending test email to:', testEmail);
console.log('🔑 Using API key:', process.env.RESEND_API_KEY ? 'Set ✅' : 'Not set ❌');
console.log('📤 From email:', process.env.RESEND_FROM_EMAIL || 'Not set');
console.log('');

sendTestEmail(testEmail)
  .then((response) => {
    console.log('');
    console.log('✅ SUCCESS! Email sent via Resend');
    console.log('📦 Full Response:', JSON.stringify(response, null, 2));
    console.log('📧 Email ID:', response.data?.id || response.id);
    console.log('');
    console.log('Next steps:');
    console.log('1. Check your inbox:', testEmail);
    console.log('2. View email logs at: https://resend.com/emails');
    console.log('');
  })
  .catch((error) => {
    console.log('');
    console.error('❌ ERROR sending email');
    console.error('Error message:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    console.error('');
    console.log('Troubleshooting:');
    console.log('1. Check RESEND_API_KEY is set in .env');
    console.log('2. Verify API key is valid (starts with re_)');
    console.log('3. For production, verify domain at resend.com');
    console.log('');
  });

