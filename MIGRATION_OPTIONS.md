# 📸 Photo Migration - Multiple Options

After the schema fix deploys, you need to migrate existing camp data. Choose ANY option below:

---

## 🌐 **OPTION 1: Browser (EASIEST)** ⏱️ 30 seconds

**No terminal required! Just click buttons.**

### Steps:
1. Go to: **https://g8road.com/migrate-photos.html**
2. Make sure you're logged in as admin
3. Click **"Check Migration Status"**
4. If needed, click **"Run Migration"**
5. Done! ✅

---

## 🔄 **OPTION 2: Auto-Migration (AUTOMATIC)** ⏱️ 0 seconds

**Migration runs automatically when server starts.**

### Setup:
Add this to Railway environment variables:
```
AUTO_MIGRATE_PHOTOS=true
```

Then redeploy or restart the server. Migration runs on startup automatically.

**To add variable:**
1. Go to Railway dashboard
2. Click your project
3. Go to "Variables" tab
4. Add: `AUTO_MIGRATE_PHOTOS` = `true`
5. Redeploy

---

## 🔗 **OPTION 3: API Endpoint (CURL)** ⏱️ 10 seconds

**Run migration via HTTP request.**

### Steps:

1. **Get your admin JWT token:**
   - Log into https://g8road.com
   - Open browser DevTools (F12)
   - Go to Application > Local Storage
   - Copy the `token` value

2. **Check if migration needed:**
```bash
curl https://api.g8road.com/api/migrate/photos-status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

3. **Run migration:**
```bash
curl https://api.g8road.com/api/migrate/photos-to-objects \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🚂 **OPTION 4: Railway CLI** ⏱️ 1 minute

**If you have Railway CLI installed and linked.**

```bash
cd /Users/mauricio/burning-man-crm/burning-man-crm
railway run node scripts/migrations/migrate-photos-to-objects.js
```

---

## 🗄️ **OPTION 5: Direct Database** ⏱️ 2 minutes

**Run directly in MongoDB Compass or mongosh.**

1. Get MongoDB URI from Railway dashboard
2. Connect to MongoDB
3. Run the script from: `scripts/migrations/migrate-photos-to-objects.js`
   (Or use the inline script from deployment docs)

---

## ✅ **RECOMMENDATION**

**Use Option 1 (Browser)** - it's the easiest and requires no terminal commands!

Just go to: **https://g8road.com/migrate-photos.html**

---

## 🔍 **How to Verify Migration Worked**

After running ANY option above:

1. **Test photo upload:**
   - Log into g8road.com as camp account
   - Go to camp profile
   - Upload a photo
   - Should return 200 (not 500!) ✅

2. **Check server logs:**
   - Look for: `✅ [Migration] Complete!`

3. **Check database:**
   - Photos should be objects: `{ url, caption, isPrimary }`
   - Not strings: `"https://..."`

---

## 🆘 **Troubleshooting**

### "Not logged in" or "Admin access required"
- Make sure you're logged in as an admin account at g8road.com
- Refresh the page and try again

### "No camps need migration"
- Great! Migration already completed or not needed
- You can proceed to test photo uploads

### Migration shows errors
- Check server logs for details
- Most likely a connection issue - try again

### Still getting 500 on upload after migration
- Check server logs for ValidationError details
- Verify schema fix was deployed
- Contact support with logs

---

## 📝 **Safe to Run Multiple Times**

All migration options are **idempotent** - safe to run multiple times:
- Already-migrated camps are skipped
- No data is lost
- No duplicates created

---

**Choose Option 1 (Browser) for easiest experience!** 🚀
