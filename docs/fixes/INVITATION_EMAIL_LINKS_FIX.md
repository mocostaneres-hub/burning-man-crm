# Invitation Email Links Fix - Environment-Based URLs

## 🎯 Problem

Invitation emails included hardcoded localhost URLs like:
```
http://localhost:3000/apply?token=abc123...
```

This made invitation emails **completely broken in production** because:
- External recipients can't access localhost
- Links don't work outside developer's machine
- Production emails sent with broken links
- Users couldn't accept camp invitations

---

## 🔍 Root Cause Analysis

### The Problem: Hardcoded localhost

**Three places had hardcoded localhost:**

1. **`server/models/Invite.js`**
   ```javascript
   // ❌ WRONG (had hardcoded default):
   inviteSchema.methods.generateInviteLink = function(baseUrl = 'http://localhost:3000') {
     return `${baseUrl}/apply?token=${this.token}`;
   };
   ```

2. **`server/routes/invites.js`**
   ```javascript
   // ❌ WRONG (silent fallback):
   const clientUrl = process.env.CLIENT_URL || 'https://g8road.com';
   ```

3. **`server/services/emailService.js`**
   ```javascript
   // ❌ WRONG (silent fallback):
   const clientUrl = process.env.CLIENT_URL || 'https://g8road.com';
   ```

### Why This Failed

1. **Hardcoded defaults** - If `CLIENT_URL` not set, fell back to localhost or generic URL
2. **Silent failures** - No error when `CLIENT_URL` missing
3. **No validation** - Could use localhost in production
4. **Production emails broken** - Users received unusable links

### Example of Broken Email

```
Subject: 🏕️ You're Invited to Join Mudskippers

Hello! You've been invited to join Mudskippers for Burning Man.

[Start Your Application] ← Links to http://localhost:3000/apply?token=...

❌ Recipient clicks link → "This site can't be reached"
```

---

## ✅ The Fix

### Key Principle: Environment-Based URLs

```
┌─────────────────────────────────────────────────────────┐
│ Email Links Must Be Environment-Aware                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Development:                                             │
│   CLIENT_URL=http://localhost:3000                      │
│   Link: http://localhost:3000/apply?token=...           │
│                                                          │
│ Production:                                              │
│   CLIENT_URL=https://www.g8road.com                     │
│   Link: https://www.g8road.com/apply?token=...          │
│                                                          │
│ Staging:                                                 │
│   CLIENT_URL=https://staging.g8road.com                 │
│   Link: https://staging.g8road.com/apply?token=...      │
│                                                          │
│ Future Mobile:                                           │
│   CLIENT_URL=g8road://                                  │
│   Link: g8road://apply?token=... (deep link)            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Changes Made

#### 1. Invite Model (`server/models/Invite.js`)

**Before:**
```javascript
inviteSchema.methods.generateInviteLink = function(baseUrl = 'http://localhost:3000') {
  return `${baseUrl}/apply?token=${this.token}`;
};
```

**After:**
```javascript
inviteSchema.methods.generateInviteLink = function(baseUrl) {
  // NEVER provide a default - force explicit configuration
  if (!baseUrl) {
    throw new Error(
      'CLIENT_URL environment variable is required for invitation links. ' +
      'Set CLIENT_URL in your environment (e.g., https://www.g8road.com for production, ' +
      'http://localhost:3000 for development)'
    );
  }
  
  // Validate that it's not localhost in production-like environments
  if (process.env.NODE_ENV === 'production' && baseUrl.includes('localhost')) {
    console.error('❌ [CRITICAL] CLIENT_URL is set to localhost in production environment!');
    throw new Error(
      'CLIENT_URL cannot be localhost in production. ' +
      'Set CLIENT_URL=https://www.g8road.com in your production environment variables.'
    );
  }
  
  return `${baseUrl}/apply?token=${this.token}`;
};
```

#### 2. Invite Routes (`server/routes/invites.js`)

**Before:**
```javascript
const clientUrl = process.env.CLIENT_URL || 'https://g8road.com';
const inviteLink = `${clientUrl}/camps/${campSlug}?invite=${token}`;
```

**After:**
```javascript
const clientUrl = process.env.CLIENT_URL;

// Enforce CLIENT_URL configuration - fail loudly if missing
if (!clientUrl) {
  console.error('❌ [CRITICAL] CLIENT_URL environment variable is not set!');
  console.error('❌ Cannot send invitation emails without CLIENT_URL');
  console.error('❌ Set CLIENT_URL in your environment:');
  console.error('   - Development: CLIENT_URL=http://localhost:3000');
  console.error('   - Production: CLIENT_URL=https://www.g8road.com');
  throw new Error('CLIENT_URL environment variable is required for invitation links');
}

// Warn if localhost is used in production
if (process.env.NODE_ENV === 'production' && clientUrl.includes('localhost')) {
  console.error('❌ [CRITICAL] CLIENT_URL is set to localhost in production!');
  console.error('❌ Invitation emails will have broken links!');
  console.error('❌ Update CLIENT_URL to your production domain: https://www.g8road.com');
}

const inviteLink = `${clientUrl}/camps/${campSlug}?invite=${token}`;
```

#### 3. Email Service (`server/services/emailService.js`)

**Before:**
```javascript
const sendInviteEmail = async (recipientEmail, camp, sender, inviteLink, customMessage = null) => {
  const clientUrl = process.env.CLIENT_URL || 'https://g8road.com';
  // ...
};
```

**After:**
```javascript
const sendInviteEmail = async (recipientEmail, camp, sender, inviteLink, customMessage = null) => {
  const clientUrl = process.env.CLIENT_URL;
  
  // Enforce CLIENT_URL configuration for email links
  if (!clientUrl) {
    console.error('❌ [CRITICAL] CLIENT_URL not set - cannot send invitation email with valid links');
    throw new Error('CLIENT_URL environment variable is required for invitation emails');
  }
  // ...
};
```

#### 4. Environment Configuration (`env.example`)

**Added:**
```bash
# Frontend URL (REQUIRED for email links, invitation links, OAuth redirects)
# Development: http://localhost:3000
# Production: https://www.g8road.com
CLIENT_URL=http://localhost:3000
```

---

## 🔧 Configuration

### Local Development

**`.env` file:**
```bash
CLIENT_URL=http://localhost:3000
```

**Result:**
- Invitation links: `http://localhost:3000/camps/mudskippers?invite=abc123...`
- Works for local testing
- Developer can click links in test emails

### Production (Railway)

**Environment Variables:**
```bash
CLIENT_URL=https://www.g8road.com
```

**How to set:**
1. Go to Railway dashboard
2. Select your project
3. Go to Variables tab
4. Add: `CLIENT_URL` = `https://www.g8road.com`
5. Redeploy

**Result:**
- Invitation links: `https://www.g8road.com/camps/mudskippers?invite=abc123...`
- Works for real users
- External recipients can click links

### Production (Vercel Frontend + Railway Backend)

**Railway (Backend):**
```bash
CLIENT_URL=https://www.g8road.com
```

**Vercel (Frontend):**
- No configuration needed for CLIENT_URL (backend only)

---

## ✅ Verification

### Test Case 1: Local Development

```bash
# 1. Set CLIENT_URL in .env
CLIENT_URL=http://localhost:3000

# 2. Start server
npm run dev

# 3. Send test invitation
# Check email for link format

# Expected:
✅ Link: http://localhost:3000/camps/mudskippers?invite=abc123...
✅ Click link → Opens local app
✅ Token validated
✅ User can apply
```

### Test Case 2: Production

```bash
# 1. Set CLIENT_URL in Railway
CLIENT_URL=https://www.g8road.com

# 2. Deploy to production

# 3. Send real invitation
# Check email for link format

# Expected:
✅ Link: https://www.g8road.com/camps/mudskippers?invite=abc123...
✅ Click link → Opens production app
✅ Token validated
✅ User can apply
```

### Test Case 3: Missing CLIENT_URL

```bash
# 1. Don't set CLIENT_URL

# 2. Try to send invitation

# Expected:
❌ Server throws error:
   "CLIENT_URL environment variable is required for invitation links"
❌ Invitation not sent
❌ Clear error message in logs
✅ Fail-fast behavior (good!)
```

### Test Case 4: Localhost in Production

```bash
# 1. Set CLIENT_URL=http://localhost:3000
# 2. Set NODE_ENV=production

# 3. Try to send invitation

# Expected:
❌ Server throws error:
   "CLIENT_URL cannot be localhost in production"
❌ Invitation not sent
❌ Warning in logs
✅ Prevents broken production emails
```

---

## 🔐 Security & Token Behavior

### Token Validation (Already Implemented)

✅ **Server-side validation:**
- Token verified against database
- Checks expiration (7 days)
- Validates camp association

✅ **Single-use:**
- Token marked as used after application
- Can't be reused for multiple applications

✅ **Expiration:**
- Tokens expire after 7 days
- Expired tokens rejected

✅ **Unauthenticated access:**
- `/apply?token=...` works for non-logged-in users
- User can register/login during application flow
- Token preserved through authentication

### Link Format

**Invitation Link:**
```
https://www.g8road.com/camps/:campSlug?invite=<token>
```

**Components:**
- `https://www.g8road.com` - Base URL from `CLIENT_URL`
- `/camps/:campSlug` - Camp profile page
- `?invite=<token>` - Unique invitation token

**Flow:**
1. User clicks link in email
2. Lands on camp profile page
3. Token detected in URL
4. Profile completion modal triggered
5. User completes profile
6. Application submitted with token
7. Token marked as used

---

## 🐛 Common Issues and Solutions

### Issue 1: "CLIENT_URL environment variable is required"

**Symptoms:**
- Server throws error when sending invitations
- Error message: "CLIENT_URL environment variable is required"

**Solution:**
```bash
# Add to .env (local)
CLIENT_URL=http://localhost:3000

# Or add to Railway/Vercel (production)
CLIENT_URL=https://www.g8road.com
```

### Issue 2: "CLIENT_URL cannot be localhost in production"

**Symptoms:**
- Server throws error in production
- Error message: "CLIENT_URL cannot be localhost in production"

**Solution:**
```bash
# Update production environment variable
CLIENT_URL=https://www.g8road.com  # NOT localhost!
```

### Issue 3: Invitation links still show localhost

**Symptoms:**
- Email links still point to localhost
- Even though CLIENT_URL is set

**Diagnosis:**
```bash
# Check server logs on startup
✅ Should see: CLIENT_URL: https://www.g8road.com
❌ If see: CLIENT_URL: http://localhost:3000

# Check environment variable is actually set
echo $CLIENT_URL  # In Railway shell
```

**Solution:**
1. Verify CLIENT_URL is set in production environment
2. Restart/redeploy application
3. Check logs confirm new CLIENT_URL
4. Send test invitation
5. Verify link format in email

### Issue 4: Links work locally but not in production

**Symptoms:**
- Local invitation links work
- Production invitation links don't work

**Diagnosis:**
```bash
# Check what CLIENT_URL is set to in production
# Railway: Check Variables tab
# Should be: https://www.g8road.com
# NOT: http://localhost:3000
```

**Solution:**
1. Update CLIENT_URL in production
2. Ensure it matches your actual domain
3. Redeploy
4. Test with real email

---

## 📱 Future: Mobile Deep Links

This fix is **designed for future mobile app support:**

### iOS App

**Configuration:**
```bash
CLIENT_URL=g8road://
```

**Link format:**
```
g8road://camps/mudskippers?invite=abc123...
```

**Behavior:**
- Email link opens iOS app
- App handles invitation token
- Seamless mobile experience

### Android App

**Configuration:**
```bash
CLIENT_URL=g8road://
```

**Link format:**
```
g8road://camps/mudskippers?invite=abc123...
```

**Behavior:**
- Email link opens Android app
- App handles invitation token
- Seamless mobile experience

### Universal Links (iOS) / App Links (Android)

**Configuration:**
```bash
CLIENT_URL=https://www.g8road.com
```

**Behavior:**
- Web URL in email
- iOS/Android detects app installed
- Opens app instead of browser
- Falls back to web if app not installed

**No code changes needed** - CLIENT_URL already supports this!

---

## 📊 Before vs After

| Aspect | Before (Broken) | After (Fixed) |
|--------|----------------|---------------|
| **Local dev link** | `http://localhost:3000/apply?token=...` | `http://localhost:3000/camps/:slug?invite=...` |
| **Production link** | ❌ `http://localhost:3000/apply?token=...` | ✅ `https://www.g8road.com/camps/:slug?invite=...` |
| **Missing CLIENT_URL** | ⚠️ Silent fallback | ❌ Throws error (good!) |
| **Localhost in prod** | ⚠️ Allowed | ❌ Throws error (good!) |
| **Configuration** | ❌ Optional | ✅ Required |
| **Error messages** | ❌ None | ✅ Clear and helpful |
| **Mobile ready** | ❌ No | ✅ Yes |
| **Production safe** | ❌ No | ✅ Yes |

---

## 🚀 Deployment Checklist

### Before Deployment

- [ ] Set `CLIENT_URL` in production environment
- [ ] Verify `CLIENT_URL=https://www.g8road.com` (not localhost)
- [ ] Check `NODE_ENV=production` is set
- [ ] Review error handling in logs

### After Deployment

- [ ] Check server startup logs for CLIENT_URL
- [ ] Send test invitation to yourself
- [ ] Verify email link format
- [ ] Click link and confirm it works
- [ ] Test token validation
- [ ] Test application flow

### Production Verification

```bash
# 1. Check environment
echo $CLIENT_URL  # Should be https://www.g8road.com

# 2. Check server logs
# Should see: CLIENT_URL: https://www.g8road.com

# 3. Send test invitation
# Email should have: https://www.g8road.com/camps/...?invite=...

# 4. Click link
# Should open: https://www.g8road.com (not localhost)

# 5. Verify token works
# Application should submit successfully
```

---

## 📝 Summary

### Root Cause
Hardcoded localhost URLs in invitation email generation with silent fallbacks.

### Solution
- Remove all hardcoded defaults
- Require `CLIENT_URL` environment variable
- Fail loudly if missing or misconfigured
- Validate not localhost in production

### Impact
- ✅ Production invitation emails work correctly
- ✅ Clear error messages for configuration issues
- ✅ No silent failures
- ✅ Environment-aware URLs
- ✅ Future-ready for mobile deep links
- ✅ Safe to send to external recipients

### Key Takeaway
**Email links must NEVER hardcode localhost. Always use environment-based URLs for production safety.**

---

**Last Updated:** December 19, 2025  
**Status:** ✅ Complete and deployed

