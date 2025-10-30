/**
 * SendGrid Test Script
 * This script tests the SendGrid email integration
 * 
 * Usage: node test-sendgrid.js YOUR_EMAIL@example.com
 */

require('dotenv').config();
const sgMail = require('@sendgrid/mail');

// Get email from command line argument
const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error('❌ Please provide a recipient email address');
  console.log('Usage: node test-sendgrid.js YOUR_EMAIL@example.com');
  process.exit(1);
}

// Check if API key is configured
if (!process.env.SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY not found in environment variables');
  console.log('Please add your SendGrid API key to your .env file:');
  console.log('SENDGRID_API_KEY=your_api_key_here');
  process.exit(1);
}

// Set the API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Create the email message
const msg = {
  to: recipientEmail,
  from: process.env.SENDGRID_FROM_EMAIL || 'noreply@g8road.com', // Use your verified sender
  subject: 'SendGrid Test Email - G8Road CRM',
  text: 'This is a test email from your G8Road CRM application using SendGrid!',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #4F46E5;">🎉 SendGrid Integration Successful!</h1>
      <p>Hello from G8Road CRM!</p>
      <p>If you're receiving this email, it means your SendGrid integration is working perfectly.</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Next Steps:</h3>
        <ul>
          <li>✅ SendGrid is properly configured</li>
          <li>✅ Emails can be sent from your application</li>
          <li>✅ Ready to implement email notifications</li>
        </ul>
      </div>
      <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="color: #999; font-size: 11px;">
        This is a test email from G8Road CRM<br>
        If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  `,
};

// Send the email
console.log('📧 Sending test email...');
console.log(`📧 To: ${recipientEmail}`);
console.log(`📧 From: ${msg.from}`);
console.log('');

sgMail
  .send(msg)
  .then(() => {
    console.log('✅ Email sent successfully!');
    console.log('');
    console.log('🎉 SendGrid Integration Complete!');
    console.log('');
    console.log('Check your inbox at:', recipientEmail);
    console.log('(Don\'t forget to check spam folder)');
  })
  .catch((error) => {
    console.error('❌ Error sending email:');
    console.error(error);
    if (error.response) {
      console.error('');
      console.error('SendGrid Error Response:');
      console.error(error.response.body);
    }
    process.exit(1);
  });

