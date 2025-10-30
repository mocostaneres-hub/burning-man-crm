# 🚀 SendGrid Quick Start Guide

## What Was Done

I've fully integrated SendGrid into your G8Road CRM! Here's what's ready to use:

✅ SendGrid package installed (`@sendgrid/mail`)  
✅ Complete email service with templates  
✅ API routes for sending emails  
✅ Test script for verification  
✅ Environment variables configured  

## ⚡ Quick Setup (3 Steps)

### Step 1: Add Your API Key

Create a `.env` file in the project root and add:

```bash
SENDGRID_API_KEY=your_api_key_from_sendgrid_here
SENDGRID_FROM_EMAIL=noreply@g8road.com
SENDGRID_FROM_NAME=G8Road
```

**Important:** Replace `your_api_key_from_sendgrid_here` with the actual API key that SendGrid provided you in their setup instructions!

### Step 2: Verify Your Sender Email

1. Go to: https://app.sendgrid.com/settings/sender_auth/senders
2. Click "Create New Sender"
3. Add your email (e.g., `noreply@g8road.com` or your personal email)
4. Verify it through the email SendGrid sends you
5. Update `SENDGRID_FROM_EMAIL` in your `.env` to match this verified email

### Step 3: Test It!

Run this command with YOUR email address:

```bash
node test-sendgrid.js your-email@example.com
```

If you see "✅ Email sent successfully!" - **you're done!** Check your inbox (and spam folder).

## 📧 What You Can Do Now

### Send Test Email from Admin Dashboard

1. Log in as admin
2. Make a POST request to: `http://localhost:5000/api/email/test`
   ```json
   {
     "to": "your-email@example.com"
   }
   ```

### Pre-Built Email Functions

Your app now has these ready-to-use email templates:

- **Application Status** - Notify users when their camp application is approved/rejected
- **Password Reset** - Send secure password reset links
- **Welcome Email** - Greet new users
- **Roster Invites** - Invite members to join camp rosters

### Example: Send Welcome Email on Registration

In `server/routes/auth.js`, add this after creating a new user:

```javascript
const { sendWelcomeEmail } = require('../services/emailService');

// After user is created...
try {
  await sendWelcomeEmail(newUser);
  console.log('Welcome email sent to', newUser.email);
} catch (error) {
  console.error('Email failed:', error.message);
  // Continue anyway - don't block registration
}
```

## 🎯 For SendGrid's Verification

When SendGrid asks you to "Implement and run the code above":

1. The code is already implemented in `test-sendgrid.js`
2. Run: `node test-sendgrid.js your-email@example.com`
3. Check your email
4. Click "Next" in SendGrid's setup wizard
5. They'll confirm your email came through ✅

## 🆘 Troubleshooting

**Email not arriving?**
- Check spam/junk folder
- Make sure sender email is verified in SendGrid
- Run the test script and check for errors

**"Unauthorized" error?**
- Check your `.env` file has the correct `SENDGRID_API_KEY`
- Make sure `.env` is in the project root (same folder as `package.json`)

**"Forbidden" error?**
- Your sender email needs to be verified in SendGrid
- Go to SendGrid → Settings → Sender Authentication

## 📚 Full Documentation

For complete details, see `SENDGRID_SETUP.md`

## ✨ You're All Set!

Your CRM can now send professional emails for:
- User notifications
- Application updates  
- Password resets
- Camp invitations
- And more!

Just remember to:
1. Add your API key to `.env`
2. Verify your sender email in SendGrid  
3. Test with the script
4. Click "Next" in SendGrid's wizard when your test email arrives

Happy emailing! 📧🔥

