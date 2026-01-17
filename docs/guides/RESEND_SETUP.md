# Resend Email Integration Setup Guide

## Overview

G8Road CRM has been migrated from SendGrid to **Resend** for email delivery. Resend offers a modern, developer-friendly API with a generous free tier.

## Why Resend?

- **Free Tier**: 3,000 emails/month (3x more than SendGrid's 100/day)
- **Modern API**: Clean, simple, and well-documented
- **Better Deliverability**: Excellent email delivery rates
- **Developer-Friendly**: Built for modern applications
- **No credit card required**: For the free tier

---

## Setup Instructions

### 1. Create Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account (no credit card required)
3. Verify your email address

### 2. Get Your API Key

1. Log in to your Resend dashboard
2. Navigate to **API Keys** in the sidebar
3. Click **Create API Key**
4. Give it a name (e.g., "G8Road CRM Production")
5. Copy the API key (starts with `re_`)

### 3. Verify Your Domain (Production)

For production use, you need to verify your sending domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `g8road.com`)
4. Add the DNS records provided by Resend to your domain's DNS settings
5. Wait for verification (usually takes a few minutes)

**Development/Testing**: You can use Resend's default domain for testing without domain verification.

### 4. Configure Environment Variables

Update your `.env` file with Resend credentials:

```env
# Email Configuration (Resend)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=G8Road
```

**Important Notes**:
- For development: Use any email like `test@resend.dev`
- For production: Use your verified domain email like `noreply@g8road.com`
- The `RESEND_FROM_NAME` is optional but recommended

### 5. Update Railway/Production Environment

If using Railway or another hosting service:

1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add or update:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `RESEND_FROM_NAME`
4. Remove old SendGrid variables:
   - `SENDGRID_API_KEY`
   - `SENDGRID_FROM_EMAIL`
   - `SENDGRID_FROM_NAME`
5. Redeploy your application

---

## Migration from SendGrid

### What Changed

**Old (SendGrid)**:
```javascript
// Required SendGrid API key
SENDGRID_API_KEY=SG.xxx
FROM_EMAIL=noreply@domain.com
```

**New (Resend)**:
```javascript
// Requires Resend API key
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@domain.com
RESEND_FROM_NAME=G8Road
```

### Code Changes

The email service (`server/services/emailService.js`) has been updated to use Resend's API. All email functions remain the same:

- `sendEmail()` - Core email sending
- `sendWelcomeEmail()` - Welcome emails for new users
- `sendApplicationStatusEmail()` - Application notifications
- `sendPasswordResetEmail()` - Password resets
- `sendRosterInviteEmail()` - Roster invitations
- `sendInviteEmail()` - Camp invitations
- `sendTestEmail()` - Test emails

**No changes required** in your application code that calls these functions!

---

## Testing Email Integration

### Test Script

Use the existing test script to verify your Resend integration:

```bash
node scripts/tests/test-sendgrid.js
```

Or create a simple test:

```javascript
const { sendTestEmail } = require('./server/services/emailService');

// Send test email
sendTestEmail('your-email@example.com')
  .then(() => console.log('✅ Test email sent'))
  .catch(err => console.error('❌ Error:', err));
```

### Check Email Logs

1. Log in to Resend dashboard
2. Go to **Emails** section
3. View all sent emails with delivery status

---

## Email Functions Available

### 1. Send Welcome Email
```javascript
await sendWelcomeEmail(user);
```

### 2. Send Application Status
```javascript
await sendApplicationStatusEmail(user, camp, 'approved'); // or 'rejected', 'pending'
```

### 3. Send Password Reset
```javascript
await sendPasswordResetEmail(user, resetToken);
```

### 4. Send Camp Invitation
```javascript
await sendInviteEmail(recipientEmail, camp, sender, inviteLink, customMessage);
```

### 5. Send Roster Invitation
```javascript
await sendRosterInviteEmail(user, camp, invitedBy);
```

---

## Troubleshooting

### Error: "Resend API key is not configured"

**Solution**: Make sure `RESEND_API_KEY` is set in your environment variables.

```bash
# Check if set
echo $RESEND_API_KEY

# Set it
export RESEND_API_KEY=re_your_key_here
```

### Error: "Invalid from address"

**Solution**: 
- For production: Verify your domain in Resend dashboard
- For development: Use `onboarding@resend.dev` or any test email

### Emails not being delivered

**Checklist**:
1. ✅ API key is valid (check Resend dashboard)
2. ✅ From email domain is verified (for production)
3. ✅ Check email logs in Resend dashboard
4. ✅ Check spam folder of recipient
5. ✅ Verify `CLIENT_URL` is set correctly in `.env`

---

## Rate Limits

### Free Tier
- **3,000 emails/month**
- **No daily limit** (just monthly)
- Perfect for small to medium camps

### If You Need More
- Resend Pro: $20/month for 50,000 emails
- Custom plans available

---

## Comparison: SendGrid vs Resend

| Feature | SendGrid (Old) | Resend (New) |
|---------|----------------|--------------|
| Free Tier | 100 emails/day | 3,000 emails/month |
| API Quality | Good | Excellent |
| Documentation | Complex | Simple |
| Setup | Credit card required | No credit card |
| Email Logs | Limited | Full logs |
| Developer Experience | OK | Excellent |

---

## Production Checklist

Before going to production with Resend:

- [ ] Create Resend account
- [ ] Get API key
- [ ] Verify your sending domain
- [ ] Update production environment variables
- [ ] Remove old SendGrid variables
- [ ] Test with `sendTestEmail()`
- [ ] Monitor first few emails in Resend dashboard
- [ ] Update backup/notification procedures

---

## Support

### Resend Resources
- Documentation: [resend.com/docs](https://resend.com/docs)
- API Reference: [resend.com/docs/api-reference](https://resend.com/docs/api-reference)
- Status Page: [status.resend.com](https://status.resend.com)

### G8Road CRM Email Service
- Code: `server/services/emailService.js`
- Tests: `scripts/tests/test-sendgrid.js` (still works with Resend)
- Configuration: `.env` file

---

## Migration Complete ✅

Your G8Road CRM is now using Resend for all email delivery. Enjoy the improved developer experience and increased email quota!

