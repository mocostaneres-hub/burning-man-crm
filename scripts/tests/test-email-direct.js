#!/usr/bin/env node

/**
 * Direct Email Test Script
 * This tests SendGrid email sending with detailed diagnostics
 */

require('dotenv').config();
const sgMail = require('@sendgrid/mail');

console.log('🔍 EMAIL DIAGNOSTIC TEST');
console.log('========================\n');

// Check environment variables
console.log('📋 Environment Check:');
console.log(`SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? '✅ Set (length: ' + process.env.SENDGRID_API_KEY.length + ')' : '❌ NOT SET'}`);
console.log(`SENDGRID_FROM_EMAIL: ${process.env.SENDGRID_FROM_EMAIL || '❌ NOT SET'}`);
console.log(`SENDGRID_FROM_NAME: ${process.env.SENDGRID_FROM_NAME || '❌ NOT SET'}`);
console.log(`CLIENT_URL: ${process.env.CLIENT_URL || 'http://localhost:3000 (default)'}`);
console.log('');

if (!process.env.SENDGRID_API_KEY) {
  console.error('❌ FATAL: SENDGRID_API_KEY is not set!');
  console.error('');
  console.error('Add it to your .env file:');
  console.error('SENDGRID_API_KEY=your_key_here');
  process.exit(1);
}

// Get recipient from command line or use default
const recipientEmail = process.argv[2] || 'info@g8road.com';

console.log(`📧 Testing email to: ${recipientEmail}\n`);

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
console.log('✅ SendGrid initialized\n');

// Test 1: New Application Notification
async function testNewApplicationEmail() {
  console.log('TEST 1: New Application Notification');
  console.log('=====================================');
  
  const mailOptions = {
    to: recipientEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || 'noreply@g8road.com',
      name: process.env.SENDGRID_FROM_NAME || 'G8Road'
    },
    subject: 'TEST - New Application to Test Camp - G8Road CRM',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🏕️ G8Road CRM - TEST EMAIL</h1>
          <p style="color: white; margin: 10px 0 0 0;">New Camp Application</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">New Application Received!</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #FF6B35; margin-top: 0;">Camp: Test Camp Name</h3>
            
            <div style="margin-bottom: 15px;">
              <strong>Applicant:</strong> Test User<br>
              <strong>Email:</strong> test@example.com<br>
              <strong>Applied:</strong> ${new Date().toLocaleDateString()}
            </div>
          </div>
          
          <p style="font-size: 12px; color: #666;">
            This is a TEST email from G8Road CRM diagnostic script.
            If you received this, SendGrid is working correctly!
          </p>
        </div>
      </div>
    `,
    text: `TEST: New application to Test Camp from Test User. If you received this, SendGrid is working!`
  };

  try {
    const response = await sgMail.send(mailOptions);
    console.log('✅ SUCCESS! Email sent');
    console.log('Response status:', response[0].statusCode);
    console.log('Response headers:', response[0].headers);
    return true;
  } catch (error) {
    console.error('❌ FAILED! Error sending email');
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Status code:', error.response.statusCode);
      console.error('Error body:', JSON.stringify(error.response.body, null, 2));
    }
    return false;
  }
}

// Test 2: Approval Email
async function testApprovalEmail() {
  console.log('\nTEST 2: Application Approval Email');
  console.log('===================================');
  
  const mailOptions = {
    to: recipientEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || 'noreply@g8road.com',
      name: process.env.SENDGRID_FROM_NAME || 'G8Road'
    },
    subject: 'TEST - 🎉 Welcome to Test Camp! - G8Road CRM',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4CAF50, #45a049); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 Congratulations! (TEST)</h1>
          <p style="color: white; margin: 10px 0 0 0;">You've been accepted!</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">Welcome to Test Camp!</h2>
          
          <p>Dear Test User,</p>
          
          <p>Great news! Your application to join <strong>Test Camp</strong> has been approved!</p>
          
          <p style="font-size: 12px; color: #666;">
            This is a TEST email. If you received this, approval emails are working!
          </p>
        </div>
      </div>
    `,
    text: `TEST: Congratulations! You've been accepted to Test Camp. If you received this, approval emails work!`
  };

  try {
    const response = await sgMail.send(mailOptions);
    console.log('✅ SUCCESS! Email sent');
    console.log('Response status:', response[0].statusCode);
    return true;
  } catch (error) {
    console.error('❌ FAILED! Error sending email');
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Status code:', error.response.statusCode);
      console.error('Error body:', JSON.stringify(error.response.body, null, 2));
    }
    return false;
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting email tests...\n');
  
  const test1 = await testNewApplicationEmail();
  const test2 = await testApprovalEmail();
  
  console.log('\n📊 TEST RESULTS');
  console.log('===============');
  console.log(`New Application Email: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Approval Email: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  
  if (test1 && test2) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('SendGrid is configured correctly and emails are being sent.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Check your email inbox (and spam folder!)');
    console.log('2. Verify emails appear in SendGrid dashboard');
    console.log('3. If production still not working, check Railway env vars');
  } else {
    console.log('\n❌ SOME TESTS FAILED');
    console.log('Check the error messages above for details.');
  }
  
  console.log('\n📝 SendGrid Dashboard: https://app.sendgrid.com');
  console.log('Activity Feed: https://app.sendgrid.com/email_activity');
}

runAllTests().catch(error => {
  console.error('\n💥 UNEXPECTED ERROR:', error);
  process.exit(1);
});

