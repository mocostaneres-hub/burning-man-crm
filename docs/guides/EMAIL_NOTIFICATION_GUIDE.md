# 📧 Email Notification Guide

## Current Email Setup

Your G8Road CRM has **TWO** email systems running:

### 1. **Nodemailer System** (OLD - Currently Active)
**Location**: `server/services/notifications.js`  
**Method**: Uses Gmail SMTP  
**Status**: ⚠️ Currently in use but should migrate to SendGrid

**Current Notifications:**
- New application submissions (to camp admins)
- Application approvals (to applicants)
- Application rejections (to applicants)

### 2. **SendGrid System** (NEW - Just Installed)
**Location**: `server/services/emailService.js`  
**Method**: SendGrid API  
**Status**: ✅ Installed and tested, ready to use

**Available Notifications:**
- Welcome emails
- Application status updates
- Password resets
- Roster invitations
- Custom emails

---

## 📝 How to Edit Email Messages

### **Option 1: Edit Existing Nodemailer Templates** (Current System)

**File**: `server/services/emailService.js`

#### **New Application Email** (Lines 47-109)
This goes to camp admins when someone applies:

```javascript
// Find this function:
async function sendEmailNotification(camp, applicant, application) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: camp.contactEmail,
    subject: `New Application to ${camp.campName} - G8Road CRM`,
    html: `
      <!-- Edit this HTML to customize the email -->
    `
  };
}
```

**What you can customize:**
- Subject line (line 51)
- HTML content (lines 52-100)
- Button link and text (lines 88-91)
- Footer text (lines 94-97)

---

#### **Application Approval Email** (Lines 150-197)
This goes to applicants when they're accepted:

```javascript
// Find this function:
async function sendApprovalNotification(applicant, camp) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: applicant.email,
    subject: `🎉 Welcome to ${camp.campName}! - G8Road CRM`,
    html: `
      <!-- Edit this HTML to customize the email -->
    `
  };
}
```

**What you can customize:**
- Subject line (line 154)
- Congratulations message (lines 162-168)
- Next steps list (lines 172-176)
- Button link and text (lines 181-184)

---

#### **Application Rejection Email** (Lines 202-247)
This goes to applicants when they're not accepted:

```javascript
// Find this function:
async function sendRejectionNotification(applicant, camp) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: applicant.email,
    subject: `Application Update - ${camp.campName} - G8Road CRM`,
    html: `
      <!-- Edit this HTML to customize the email -->
    `
  };
}
```

**What you can customize:**
- Subject line (line 206)
- Rejection message (lines 217-223)
- Button link and text (lines 225-229)
- Closing message (lines 232-235)

---

### **Option 2: Use New SendGrid Templates** (Recommended)

**File**: `server/services/emailService.js`

The new SendGrid system has better templates. Here's where to edit them:

#### **Application Status Email** (Lines 69-114)

```javascript
async function sendApplicationStatusEmail(user, camp, status) {
  const statusMessages = {
    approved: {
      subject: `🎉 Your application to ${camp.name} has been approved!`,
      html: `
        <h2>Congratulations!</h2>
        <p>Hi ${user.firstName},</p>
        <p>Great news! Your application to join <strong>${camp.name}</strong> has been approved.</p>
        <!-- Edit this HTML -->
      `
    },
    rejected: {
      subject: `Application Update: ${camp.name}`,
      html: `
        <h2>Application Status Update</h2>
        <!-- Edit this HTML -->
      `
    },
    pending: {
      subject: `Application Received: ${camp.name}`,
      html: `
        <h2>Application Received</h2>
        <!-- Edit this HTML -->
      `
    }
  };
}
```

---

#### **Welcome Email** (Lines 145-165)

```javascript
async function sendWelcomeEmail(user) {
  return sendEmail({
    to: user.email,
    subject: 'Welcome to G8Road! 🔥',
    html: `
      <h1>Welcome to G8Road!</h1>
      <p>Hi ${user.firstName},</p>
      <p>We're excited to have you join our Burning Man community!</p>
      <!-- Edit this HTML -->
    `
  });
}
```

---

#### **Password Reset Email** (Lines 125-143)

```javascript
async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${process.env.CLIENT_URL || 'https://g8road.com'}/reset-password/${resetToken}`;

  return sendEmail({
    to: user.email,
    subject: 'Password Reset Request - G8Road',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${user.firstName || 'there'},</p>
      <!-- Edit this HTML -->
    `
  });
}
```

---

#### **Roster Invite Email** (Lines 167-187)

```javascript
async function sendRosterInviteEmail(user, camp, invitedBy) {
  return sendEmail({
    to: user.email,
    subject: `You've been invited to join ${camp.name}!`,
    html: `
      <h2>Camp Invitation</h2>
      <p>Hi ${user.firstName},</p>
      <!-- Edit this HTML -->
    `
  });
}
```

---

## 🔄 Migration Recommendation

### **Why Switch to SendGrid?**

1. ✅ **Better Deliverability** - Emails less likely to go to spam
2. ✅ **Analytics** - Track opens, clicks, bounces
3. ✅ **Scalability** - Handle more emails easily
4. ✅ **Professional** - Better reputation for transactional emails
5. ✅ **Already Set Up** - SendGrid is configured and tested

### **How to Switch:**

Currently, applications use the OLD system. To switch to SendGrid:

**In `server/routes/applications.js`:**

Replace this (line 245):
```javascript
await sendApplicationNotification(camp, req.user, application);
```

With this:
```javascript
const { sendApplicationStatusEmail } = require('../services/emailService');
await sendApplicationStatusEmail(req.user, camp, 'pending');
```

---

## 🎨 Email Styling Tips

### **Colors in Your Emails:**
- **Primary**: `#4F46E5` (purple/blue)
- **Success**: `#4CAF50` (green)
- **Warning**: `#FF6B35` (orange)
- **Error**: `#EF4444` (red)

### **Common Variables You Can Use:**
- `${user.firstName}` - User's first name
- `${user.lastName}` - User's last name
- `${user.email}` - User's email
- `${camp.name}` or `${camp.campName}` - Camp name
- `${process.env.CLIENT_URL}` - Your site URL

### **HTML Email Best Practices:**
- Use inline styles (not CSS classes)
- Use tables for layout (yes, really!)
- Keep width under 600px
- Test in multiple email clients
- Always include plain text version

---

## 🧪 How to Test Email Changes

### **Method 1: Use the Test Script**
```bash
node test-sendgrid.js your-email@example.com
```

### **Method 2: Use the API Endpoint**
```bash
curl -X POST http://localhost:5000/api/email/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

### **Method 3: Trigger Real Notifications**
1. Create a test camp
2. Apply to the camp
3. Approve/reject the application
4. Check your email!

---

## 📚 Quick Reference

### **Where Emails Are Sent From:**

| Trigger | Current System | File | Function |
|---------|---------------|------|----------|
| User applies to camp | Nodemailer | `notifications.js` | `sendApplicationNotification()` |
| Application approved | Nodemailer | `notifications.js` | `sendApprovalNotification()` |
| Application rejected | Nodemailer | `notifications.js` | `sendRejectionNotification()` |
| New user welcome | SendGrid (ready) | `emailService.js` | `sendWelcomeEmail()` |
| Password reset | SendGrid (ready) | `emailService.js` | `sendPasswordResetEmail()` |
| Roster invite | SendGrid (ready) | `emailService.js` | `sendRosterInviteEmail()` |

---

## 🆘 Common Issues

### **Emails not sending?**
1. Check `.env` file has correct credentials
2. Check server logs for errors
3. Verify email address is valid
4. Check spam folder

### **Emails look broken?**
1. Test in multiple email clients
2. Use inline styles only
3. Keep HTML simple
4. Use tables for layout

### **Want to preview emails before sending?**
Consider using a service like:
- Mailtrap (for testing)
- Litmus (for previewing)
- Email on Acid (for testing)

---

## 💡 Pro Tips

1. **Keep a consistent style** across all emails
2. **Include your logo** at the top
3. **Always have a clear call-to-action** button
4. **Test on mobile** - most people read email on phones
5. **Include plain text version** as fallback
6. **Track important metrics** in SendGrid dashboard
7. **A/B test** subject lines for better open rates

---

## 🔗 Helpful Links

- [SendGrid Dashboard](https://app.sendgrid.com/)
- [SendGrid Email Templates](https://docs.sendgrid.com/ui/sending-email/getting-started-with-email-templates)
- [Email Design Best Practices](https://docs.sendgrid.com/ui/sending-email/email-design-best-practices)
- [HTML Email Guide](https://www.campaignmonitor.com/css/)

---

**Need help?** Check the logs in your server console or SendGrid dashboard for detailed error messages!

