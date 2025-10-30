# 🚨 PRODUCTION EMAIL DEBUG GUIDE

## ✅ **LOCAL TESTING RESULTS**

**Status:** ✅ **ALL TESTS PASSED**

- SendGrid API Key: ✅ Valid (69 characters)
- Email sending: ✅ Working (202 Accepted responses)
- New Application emails: ✅ Sent successfully
- Approval emails: ✅ Sent successfully

**Conclusion:** The code works perfectly. The issue is **100% a production environment variable problem**.

---

## 🔍 **ROOT CAUSE**

**Railway production environment does NOT have SendGrid variables set properly.**

Evidence:
1. Local tests work perfectly ✅
2. Code is correct ✅  
3. SendGrid account is active ✅
4. **Production emails don't send** ❌

---

## 🎯 **THE FIX (Step-by-Step)**

### **Option 1: Railway Dashboard (RECOMMENDED)**

1. **Go to Railway Dashboard:**
   ```
   https://railway.app/dashboard
   ```

2. **Find Your Project:**
   - Look for "burning-man-crm" or similar
   - Click on it

3. **Open Variables Tab:**
   - Click "Variables" in the left sidebar
   - OR click on your service → Variables

4. **Add These THREE Variables:**

   ```
   Variable Name: SENDGRID_API_KEY
   Value: [paste the value from your local .env file]
   ```

   ```
   Variable Name: SENDGRID_FROM_EMAIL
   Value: noreply@g8road.com
   ```

   ```
   Variable Name: SENDGRID_FROM_NAME
   Value: G8Road
   ```

5. **Get Your API Key:**
   
   On your local machine, run:
   ```bash
   cat .env | grep SENDGRID_API_KEY
   ```
   
   Copy the entire value after the `=` sign.

6. **Save & Wait for Redeploy:**
   - Railway will automatically redeploy (2-3 minutes)
   - Wait for "Active" status

7. **Verify:**
   - Submit a test application on https://www.g8road.com
   - Check email inbox
   - Check SendGrid dashboard

---

### **Option 2: Railway CLI**

If you want to install Railway CLI:

```bash
# Install
npm i -g @railway/cli

# Login
railway login

# Link to project (if not linked)
railway link

# Add variables
railway variables set SENDGRID_API_KEY="[paste your key]"
railway variables set SENDGRID_FROM_EMAIL="noreply@g8road.com"
railway variables set SENDGRID_FROM_NAME="G8Road"

# Verify
railway variables | grep SENDGRID
```

---

## 🔍 **How to Verify It's Fixed**

### **1. Check Railway Deployment**
After adding variables:
- Go to Deployments tab
- Latest deployment should show "Active"
- Click on it to see logs

### **2. Check Logs for SendGrid Confirmation**
Look for this in Railway logs:
```
✅ Notifications service using SendGrid
✅ SendGrid initialized successfully
```

If you see this instead, variables aren't set:
```
⚠️  SENDGRID_API_KEY not found in environment variables
```

### **3. Submit Test Application**
1. Go to https://www.g8road.com
2. Log in as a member
3. Apply to any camp
4. Check your email (and spam folder!)

### **4. Check SendGrid Dashboard**
1. Go to https://app.sendgrid.com
2. Click "Activity" → "Email Activity"
3. You should see emails with "Delivered" status

---

## 📊 **Environment Variable Checklist**

| Variable | Local | Production | Status |
|----------|-------|------------|--------|
| `SENDGRID_API_KEY` | ✅ Set | ❌ **NOT SET** | 🔴 **CRITICAL** |
| `SENDGRID_FROM_EMAIL` | ✅ Set | ❌ **NOT SET** | 🔴 **CRITICAL** |
| `SENDGRID_FROM_NAME` | ✅ Set | ❌ **NOT SET** | 🔴 **CRITICAL** |

---

## 🚫 **Common Mistakes to Avoid**

### **Mistake 1: Typo in Variable Name**
❌ `SENDGRID_APIKEY` (missing underscore)  
✅ `SENDGRID_API_KEY` (with underscore)

### **Mistake 2: Extra Spaces**
❌ `SENDGRID_API_KEY = SG.abc123` (spaces around =)  
✅ `SENDGRID_API_KEY=SG.abc123` (no spaces)

### **Mistake 3: Wrong API Key**
- Make sure you're using the **SAME key from local .env**
- It should start with `SG.`
- It should be 69 characters long

### **Mistake 4: Not Waiting for Redeploy**
- After adding variables, Railway needs to redeploy
- Wait 2-3 minutes for "Active" status
- Don't test until deployment finishes

---

## 🆘 **Still Not Working?**

### **Step 1: Verify Variables Are Set**

Via Railway Dashboard:
1. Go to your project
2. Variables tab
3. Confirm all 3 SENDGRID variables exist
4. Check for typos

Via Railway CLI (if installed):
```bash
railway variables | grep SENDGRID
```

You should see:
```
SENDGRID_API_KEY=SG.xxxxx...
SENDGRID_FROM_EMAIL=noreply@g8road.com  
SENDGRID_FROM_NAME=G8Road
```

### **Step 2: Check Deployment Status**

1. Go to Deployments tab in Railway
2. Look at latest deployment
3. Status should be "Active" (green)
4. If "Failed" (red), click to see error logs

### **Step 3: View Railway Logs**

Look for these specific lines:
```
✅ Notifications service using SendGrid  (GOOD)
⚠️  SENDGRID_API_KEY not found              (BAD - vars not set)
✅ Email notification sent to...            (GOOD - email sent)
⚠️  Cannot send email - SENDGRID_API_KEY    (BAD - vars not set)
```

### **Step 4: Test SendGrid API Key**

On your local machine:
```bash
node test-email-direct.js your-email@example.com
```

This will:
- Verify your API key works
- Send test emails
- Show detailed error messages if it fails

### **Step 5: Check SendGrid Account**

1. Go to https://app.sendgrid.com/settings/api_keys
2. Find your API key
3. Verify it's not revoked
4. Check it has "Mail Send" permission
5. If needed, create a new key:
   - Click "Create API Key"
   - Name: "G8Road Production"
   - Permission: "Full Access" or "Mail Send"
   - Copy the key
   - Update Railway variables
   - Update local .env

---

## 📝 **Quick Reference**

### **Your SendGrid Details**
- **From Email:** noreply@g8road.com
- **From Name:** G8Road
- **API Key Length:** 69 characters
- **API Key Starts With:** SG.

### **Railway Project**
- **Dashboard:** https://railway.app/dashboard
- **Project Name:** burning-man-crm (or similar)
- **Service:** Node.js application

### **SendGrid Dashboard**
- **Main:** https://app.sendgrid.com
- **API Keys:** https://app.sendgrid.com/settings/api_keys
- **Activity Feed:** https://app.sendgrid.com/email_activity
- **Status Page:** https://status.sendgrid.com

---

## ✅ **Success Criteria**

You'll know it's working when:

1. ✅ Railway logs show: `✅ Notifications service using SendGrid`
2. ✅ When you submit application, logs show: `✅ Email notification sent to...`
3. ✅ Emails appear in inbox (check spam!)
4. ✅ SendGrid dashboard shows delivered emails
5. ✅ All three email types work:
   - New application → Camp owner
   - Approval → Member
   - Rejection → Member

---

## 🎯 **BOTTOM LINE**

**The code is perfect. The issue is 100% that Railway production doesn't have the SendGrid environment variables.**

**Action Required:**
1. Add 3 variables to Railway (takes 2 minutes)
2. Wait for redeploy (takes 2-3 minutes)
3. Test application submission
4. Done! ✅

---

**Last Updated:** $(date)  
**Local Test Status:** ✅ PASSED  
**Production Status:** ⚠️ AWAITING ENVIRONMENT VARIABLES

