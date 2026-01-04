# 🚨 FIX EMAIL NOTIFICATIONS - ACTION REQUIRED

## ⚠️ **Current Status: NO EMAILS ARE BEING SENT**

**Why:** Production environment (Railway) **does not have SendGrid configuration**

---

## 🔧 **Quick Fix (2 minutes)**

### **Option 1: Using Railway Dashboard (Easiest)**

1. Go to **https://railway.app/dashboard**
2. Click on your **burning-man-crm** project
3. Click on the **Variables** tab
4. Add these 3 variables:

```
SENDGRID_API_KEY = [copy from your local .env file]
SENDGRID_FROM_EMAIL = noreply@g8road.com
SENDGRID_FROM_NAME = G8Road
```

5. Railway will **automatically redeploy** (takes 2-3 minutes)
6. ✅ **Done!** Emails will work after redeployment

---

### **Option 2: Using Railway CLI (Fastest)**

If you have Railway CLI installed:

```bash
# Navigate to project directory
cd /Users/mauricio/burning-man-crm/burning-man-crm

# Run the automated script
./add-sendgrid-to-railway.sh
```

**OR manually:**

```bash
# Get your API key from .env
cat .env | grep SENDGRID_API_KEY

# Add variables
railway variables set SENDGRID_API_KEY="[paste your key]"
railway variables set SENDGRID_FROM_EMAIL="noreply@g8road.com"
railway variables set SENDGRID_FROM_NAME="G8Road"

# Verify
railway variables
```

---

### **Option 3: Install Railway CLI First**

If you don't have Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project (if not linked)
railway link

# Then follow Option 2 above
```

---

## 🕵️ **Why Emails Aren't Working**

### **Local Development:**
- ✅ SendGrid configured in `.env`
- ✅ Code works correctly
- ❌ **Server crashes** (port 5000 already in use)
- ❌ Can't test locally until server starts

### **Production (Railway):**
- ✅ Code deployed successfully
- ✅ Server running
- ❌ **SendGrid environment variables MISSING**
- ❌ Emails fail silently (caught by try-catch)
- ❌ No emails sent to SendGrid

---

## 📊 **What Happens Without SendGrid Variables**

**When someone submits an application:**

1. Application is created ✅
2. Backend tries to send email
3. SendGrid check fails: `if (!process.env.SENDGRID_API_KEY)`
4. Console warning: `⚠️ Cannot send email - SENDGRID_API_KEY not configured`
5. Function returns early (no email sent)
6. User sees success message ✅ (because we fixed the error handling)
7. **BUT no email is actually sent** ❌

**Your production logs should show:**
```
⚠️  Cannot send email - SENDGRID_API_KEY not configured
```

---

## ✅ **How to Verify It's Fixed**

### **Step 1: Check Railway Logs**

After adding variables and redeployment:

1. Go to Railway dashboard
2. Click on your project
3. Go to **Deployments** tab
4. Click latest deployment
5. Check logs for:

```
✅ Notifications service using SendGrid
✅ SendGrid initialized successfully
```

If you see this instead, variables aren't set:
```
⚠️  SENDGRID_API_KEY not found in environment variables
```

### **Step 2: Test Email Sending**

1. Go to **https://www.g8road.com**
2. Log in as a member
3. Apply to any camp
4. **Check emails:**
   - You should receive application confirmation (if implemented)
   - Camp admin should receive new application notification

### **Step 3: Check SendGrid Dashboard**

1. Go to **https://app.sendgrid.com**
2. Navigate to **Activity** → **Email Activity**
3. You should see your sent emails with status:
   - **Delivered** = ✅ Success
   - **Processed** = ✅ On its way
   - **Bounced** = ❌ Invalid email
   - **Deferred** = ⏳ Retry in progress

---

## 🐛 **Troubleshooting Local Development**

Your local server keeps crashing because port 5000 is already in use.

**Quick Fix:**
```bash
# Kill the process using port 5000
lsof -ti:5000 | xargs kill -9

# Or find and kill manually
lsof -i:5000
# Note the PID, then:
kill -9 [PID]

# Restart your server
npm run dev
# or
node server/index.js
```

**Permanent Fix:**

Change your server port in `.env`:
```bash
PORT=5001
```

Or add this to `server/index.js`:
```javascript
const PORT = process.env.PORT || 5001; // Changed from 5000
```

---

## 📧 **Emails That Will Be Sent**

Once configured, these emails will be automatically sent:

### **1. New Application Notification** 📧
- **To:** Camp admin (camp.contactEmail)
- **When:** Member submits application
- **Subject:** "New Application to {Camp Name} - G8Road CRM"
- **Content:** Applicant details, motivation, review link

### **2. Application Approval** 🎉
- **To:** Applicant
- **When:** Camp admin approves application
- **Subject:** "🎉 Welcome to {Camp Name}! - G8Road CRM"
- **Content:** Congratulations, next steps, dashboard link

### **3. Application Rejection** 📋
- **To:** Applicant
- **When:** Camp admin rejects application
- **Subject:** "Application Update - {Camp Name} - G8Road CRM"
- **Content:** Professional rejection, encouragement to explore other camps

---

## 🔒 **Security Note**

Your SendGrid API key is in your local `.env` file (which is `.gitignore`d - good!).

**Never:**
- ❌ Commit API keys to Git
- ❌ Share API keys in screenshots
- ❌ Post API keys in support tickets

**Do:**
- ✅ Keep API keys in environment variables
- ✅ Use different keys for dev/prod (optional but recommended)
- ✅ Rotate keys if exposed

---

## 🚀 **Quick Summary**

**Problem:** 
- No emails being sent
- SendGrid variables missing from production

**Solution:**
1. Add 3 environment variables to Railway
2. Wait for automatic redeployment (2-3 minutes)
3. Test by submitting an application
4. Verify in SendGrid dashboard

**Time Required:** 2 minutes to add variables, 3 minutes to redeploy

**Impact:** All email notifications will work immediately after fix

---

## 📞 **Still Not Working?**

If emails still don't send after adding variables:

### **Check Railway Logs:**
```bash
railway logs
```

Look for:
- ✅ `Notifications service using SendGrid`
- ❌ `Cannot send email - SENDGRID_API_KEY not configured`
- ❌ `Error sending email notification`

### **Check SendGrid API Key:**
1. Go to https://app.sendgrid.com/settings/api_keys
2. Verify your API key is active
3. Check it has **"Mail Send"** permission
4. If needed, create a new key with **Full Access**

### **Check Camp Contact Email:**
```javascript
// In Railway logs, look for:
⚠️  Failed to send application notification
```

This might mean the camp doesn't have a `contactEmail` set. Check in admin dashboard.

---

## 📝 **Deployment Checklist**

- [ ] Add `SENDGRID_API_KEY` to Railway
- [ ] Add `SENDGRID_FROM_EMAIL` to Railway  
- [ ] Add `SENDGRID_FROM_NAME` to Railway
- [ ] Wait for Railway redeployment
- [ ] Check Railway logs for SendGrid confirmation
- [ ] Submit test application
- [ ] Check recipient email inbox (and spam folder)
- [ ] Verify in SendGrid dashboard
- [ ] Celebrate! 🎉

---

## 🆘 **Getting Help**

**Railway Support:**
- Dashboard: https://railway.app/dashboard
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway

**SendGrid Support:**
- Dashboard: https://app.sendgrid.com
- Docs: https://docs.sendgrid.com
- Status: https://status.sendgrid.com

---

**Last Updated:** $(date)  
**Status:** ⚠️ **ACTION REQUIRED - Add SendGrid variables to Railway**

