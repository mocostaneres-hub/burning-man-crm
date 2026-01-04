# 🚀 SendGrid Production Setup - CRITICAL

## ⚠️ **IMMEDIATE ACTION REQUIRED**

Your email notifications were **NOT working** because they were trying to use Gmail/Nodemailer instead of SendGrid.

**Status:**
- ✅ **Local Development:** SendGrid is configured and working
- ❌ **Production:** SendGrid environment variables are **MISSING**

---

## 🔧 What Was Fixed

### Before (Broken):
- Application notifications used Nodemailer with Gmail
- Required `EMAIL_USER` and `EMAIL_PASS` (not configured)
- **Result:** No emails were sent at all

### After (Fixed):
- All notifications now use SendGrid
- Uses your working `SENDGRID_API_KEY`
- **Result:** Emails will work once production env is updated

---

## 📋 Required Environment Variables

Add these **3 variables** to your production environment:

```bash
SENDGRID_API_KEY=your_sendgrid_api_key_from_local_env_file
SENDGRID_FROM_EMAIL=noreply@g8road.com
SENDGRID_FROM_NAME=G8Road
```

### **Important Note:**
Use the API key from your local `.env` file (starts with `SG.`). For production, you should:
1. Use the **SAME key** that's working locally, OR
2. Create a **new key** in SendGrid dashboard specifically for production

---

## 🎯 How to Add Variables (Platform-Specific)

### **Option 1: Vercel** (if using Vercel)

#### Via Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Select your project: `burning-man-crm`
3. Go to **Settings** → **Environment Variables**
4. Add these 3 variables (use the API key from your local `.env` file):
   - `SENDGRID_API_KEY` = `[paste your API key from .env]`
   - `SENDGRID_FROM_EMAIL` = `noreply@g8road.com`
   - `SENDGRID_FROM_NAME` = `G8Road`
5. Make sure to select **Production** environment
6. Click **Save**
7. **Redeploy** your application (Deployments → ... → Redeploy)

#### Via Vercel CLI:
```bash
vercel env add SENDGRID_API_KEY production
# Paste your SendGrid API key from .env file

vercel env add SENDGRID_FROM_EMAIL production
# Enter: noreply@g8road.com

vercel env add SENDGRID_FROM_NAME production
# Enter: G8Road

# Redeploy
vercel --prod
```

---

### **Option 2: Railway** (if using Railway)

#### Via Railway Dashboard:
1. Go to https://railway.app/dashboard
2. Select your project
3. Go to **Variables** tab
4. Add these 3 variables (use the API key from your local `.env` file):
   - `SENDGRID_API_KEY` = `[paste your API key]`
   - `SENDGRID_FROM_EMAIL` = `noreply@g8road.com`
   - `SENDGRID_FROM_NAME` = `G8Road`
5. Railway will automatically redeploy

#### Via Railway CLI (if installed):
```bash
railway variables set SENDGRID_API_KEY="[paste_your_api_key_here]"
railway variables set SENDGRID_FROM_EMAIL="noreply@g8road.com"
railway variables set SENDGRID_FROM_NAME="G8Road"
```

---

### **Option 3: Other Hosting (Heroku, AWS, etc.)**

Follow your platform's documentation for setting environment variables. The three variables you need are:
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `SENDGRID_FROM_NAME`

---

## ✅ How to Verify It's Working

### Step 1: Check Server Logs
After deployment, check your server logs for:
```
✅ Notifications service using SendGrid
```

If you see this warning instead, env vars aren't set:
```
⚠️  SENDGRID_API_KEY not found - email notifications will not work
```

### Step 2: Test Email Sending
1. Go to your live site: https://www.g8road.com
2. Log in as a member
3. Apply to a camp
4. Check your email (or the camp admin's email)
5. You should receive the "New Application" email

### Step 3: Check SendGrid Dashboard
1. Go to https://app.sendgrid.com
2. Navigate to **Activity** → **Email Activity**
3. You should see your sent emails with delivery status

---

## 🔍 Troubleshooting

### Issue: "SENDGRID_API_KEY not found"
**Solution:** Environment variables not set in production. Follow steps above.

### Issue: Emails not showing in SendGrid dashboard
**Solution:**
1. Check that API key is correct (no extra spaces)
2. Verify API key has "Mail Send" permissions in SendGrid
3. Check server logs for error messages

### Issue: "Authentication failed"
**Solution:**
1. API key might be invalid or revoked
2. Generate a new API key in SendGrid:
   - Go to https://app.sendgrid.com/settings/api_keys
   - Click "Create API Key"
   - Give it "Full Access" or "Mail Send" permission
   - Copy the new key
   - Update production environment variables

### Issue: Emails go to spam
**Solution:**
1. Verify your domain (noreply@g8road.com) in SendGrid
2. Set up SPF and DKIM records for your domain
3. See: https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication

---

## 📧 Email Notifications That Will Now Work

Once production env is updated, these emails will be sent automatically:

### 1. **New Application Notification** ✉️
- **To:** Camp admin's contact email
- **When:** Someone submits an application to the camp
- **Subject:** "New Application to {Camp Name} - G8Road CRM"

### 2. **Application Approval** 🎉
- **To:** Applicant's email
- **When:** Camp admin approves an application
- **Subject:** "🎉 Welcome to {Camp Name}! - G8Road CRM"

### 3. **Application Rejection** 📋
- **To:** Applicant's email
- **When:** Camp admin rejects an application
- **Subject:** "Application Update - {Camp Name} - G8Road CRM"

---

## 🎨 What's in the Emails

All emails now include:
- Professional HTML design with G8Road branding
- Gradient header (orange/coral color scheme)
- Responsive layout that works on mobile
- Plain text fallback for email clients without HTML support
- Proper sender information (G8Road via noreply@g8road.com)
- Links to dashboard/camps
- Automated footer

---

## 📊 Monitoring Email Deliverability

### In SendGrid Dashboard:
1. **Email Activity:** See all sent emails and their status
2. **Stats:** View open rates, click rates, bounce rates
3. **Alerts:** Get notified of delivery issues
4. **Suppressions:** See bounced/spam-reported addresses

### Best Practices:
- Monitor your SendGrid dashboard weekly
- Check bounce rates (should be < 5%)
- Review spam reports
- Keep your sender reputation high

---

## 🔒 Security Notes

### API Key Security:
- ✅ API key is in `.env` (not committed to Git)
- ⚠️ This guide contains the key for setup purposes
- 🔐 Consider rotating the key after production setup
- 🚫 Never expose API keys in client-side code

### Rotating API Keys:
If you need to rotate your API key:
1. Create new key in SendGrid
2. Update production environment variables
3. Update local `.env` file
4. Revoke old key in SendGrid

---

## 📝 Quick Reference

### Files Modified:
- `server/services/notifications.js` - Main notification service
- Uses `@sendgrid/mail` package (already installed)

### Console Logs to Watch For:
- ✅ `Notifications service using SendGrid`
- ✅ `Email notification sent to {email} via SendGrid`
- ❌ `Error sending email notification`
- ⚠️ `SENDGRID_API_KEY not found`

---

## 🚀 Deployment Checklist

- [ ] Add `SENDGRID_API_KEY` to production environment
- [ ] Add `SENDGRID_FROM_EMAIL` to production environment
- [ ] Add `SENDGRID_FROM_NAME` to production environment
- [ ] Redeploy application
- [ ] Check server logs for SendGrid confirmation
- [ ] Test by submitting a camp application
- [ ] Verify email received
- [ ] Check SendGrid dashboard for delivery status
- [ ] Update this checklist when complete ✅

---

## 🆘 Need Help?

If emails still aren't working after following this guide:

1. **Check server logs** for error messages
2. **Verify API key** has correct permissions in SendGrid
3. **Test locally first** to ensure code changes work
4. **Check SendGrid status** at https://status.sendgrid.com
5. **Review SendGrid docs** at https://docs.sendgrid.com

---

## 📌 Summary

**Problem:** Email notifications weren't working at all  
**Root Cause:** Using Nodemailer (not configured) instead of SendGrid  
**Solution:** Migrated to SendGrid (already set up and working locally)  
**Action Required:** Add 3 environment variables to production  
**Time to Fix:** 5 minutes  
**Impact:** All application notifications will work  

---

**Last Updated:** $(date)  
**Status:** ⚠️ Awaiting production environment variable configuration

