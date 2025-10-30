# SendGrid Email Integration Setup

This guide will help you set up SendGrid email notifications for the G8Road CRM.

## ✅ Setup Complete!

The following has been installed and configured:

- ✅ `@sendgrid/mail` package installed
- ✅ Email service created (`server/services/emailService.js`)
- ✅ Email API routes created (`server/routes/email.js`)
- ✅ Test script created (`test-sendgrid.js`)

## 🔧 Configuration Steps

### 1. Add SendGrid API Key to Environment Variables

Create a `.env` file in the root directory (if you don't have one already) and add:

```bash
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@g8road.com
SENDGRID_FROM_NAME=G8Road
```

**Note:** Use the SendGrid API key that was provided to you during setup. Never commit this key to version control!

**Important:** Replace the `SENDGRID_FROM_EMAIL` with your verified sender email in SendGrid.

### 2. Verify Your Sender Email

Before you can send emails, you need to verify your sender email address in SendGrid:

1. Go to https://app.sendgrid.com/settings/sender_auth/senders
2. Click "Create New Sender" or "Verify an Existing Sender"
3. Follow the verification steps
4. Use this verified email as your `SENDGRID_FROM_EMAIL`

### 3. Test the Integration

Run the test script to verify SendGrid is working:

```bash
node test-sendgrid.js your-email@example.com
```

This will send a test email to the specified address.

## 📧 Available Email Functions

The email service (`server/services/emailService.js`) includes these pre-built functions:

### 1. **sendEmail** - Send custom emails
```javascript
await sendEmail({
  to: 'user@example.com',
  subject: 'Hello!',
  html: '<h1>Welcome!</h1>',
  text: 'Welcome!'
});
```

### 2. **sendApplicationStatusEmail** - Application notifications
```javascript
await sendApplicationStatusEmail(user, camp, 'approved');
// status can be: 'approved', 'rejected', 'pending'
```

### 3. **sendPasswordResetEmail** - Password reset emails
```javascript
await sendPasswordResetEmail(user, resetToken);
```

### 4. **sendWelcomeEmail** - Welcome new users
```javascript
await sendWelcomeEmail(user);
```

### 5. **sendRosterInviteEmail** - Camp roster invitations
```javascript
await sendRosterInviteEmail(user, camp, invitedBy);
```

### 6. **sendTestEmail** - Send test emails
```javascript
await sendTestEmail('test@example.com');
```

## 🚀 API Endpoints

The following email endpoints are available (all require admin authentication):

### Check SendGrid Status
```
GET /api/email/status
```

### Send Test Email
```
POST /api/email/test
Body: { "to": "email@example.com" }
```

### Send Custom Email
```
POST /api/email/send
Body: {
  "to": "email@example.com",
  "subject": "Subject Line",
  "html": "<h1>Email Content</h1>",
  "text": "Plain text content"
}
```

### Send Welcome Email
```
POST /api/email/welcome
Body: { "userId": "user_id_here" }
```

## 🔗 Integrating Email Notifications

### Example: Send email when application is approved

In `server/routes/applications.js`, after approving an application:

```javascript
const { sendApplicationStatusEmail } = require('../services/emailService');

// After approval logic...
try {
  await sendApplicationStatusEmail(user, camp, 'approved');
  console.log('Application approval email sent');
} catch (emailError) {
  console.error('Failed to send email:', emailError);
  // Don't fail the application approval if email fails
}
```

### Example: Send welcome email on registration

In `server/routes/auth.js`, after user registration:

```javascript
const { sendWelcomeEmail } = require('../services/emailService');

// After creating new user...
try {
  await sendWelcomeEmail(newUser);
} catch (emailError) {
  console.error('Failed to send welcome email:', emailError);
}
```

## 🎯 Best Practices

1. **Always wrap email sending in try-catch blocks** - Don't let email failures break your app
2. **Log email errors** - Use `console.error` to track email issues
3. **Test in development** - Use the test endpoints before deploying
4. **Check spam folders** - Initial emails may land in spam
5. **Use templates** - Create consistent, branded email templates
6. **Monitor SendGrid dashboard** - Track delivery rates and issues

## 📊 SendGrid Dashboard

Monitor your email activity at: https://app.sendgrid.com/

- View email statistics
- Check delivery rates
- Monitor bounces and spam reports
- Manage API keys
- Configure sender authentication

## 🔒 Security Notes

- **Never commit your API key to git** - Keep it in `.env` file (already in `.gitignore`)
- **Use environment variables** - Different keys for development/production
- **Restrict API key permissions** - Only grant necessary permissions in SendGrid
- **Monitor usage** - Check for unusual activity in SendGrid dashboard

## 🆘 Troubleshooting

### Email not received?
1. Check spam/junk folder
2. Verify sender email is authenticated in SendGrid
3. Check SendGrid dashboard for delivery status
4. Run the test script to verify configuration

### "Unauthorized" error?
- Check if `SENDGRID_API_KEY` is correctly set in `.env`
- Verify API key is active in SendGrid dashboard

### "Forbidden" error?
- Sender email must be verified in SendGrid
- Update `SENDGRID_FROM_EMAIL` to your verified sender

## 📚 Resources

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid Node.js Library](https://github.com/sendgrid/sendgrid-nodejs)
- [Email Best Practices](https://docs.sendgrid.com/ui/sending-email/getting-started-with-email-templates)

## ✨ Next Steps

1. Add your SendGrid API key to `.env`
2. Verify your sender email in SendGrid
3. Run the test script: `node test-sendgrid.js your-email@example.com`
4. Integrate email notifications into your application workflows
5. Test thoroughly before deploying to production

Happy emailing! 📧🔥

