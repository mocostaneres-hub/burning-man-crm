# Camp Admin Photo Upload Authorization Fix - Final Resolution

## 🎯 ROOT CAUSE IDENTIFIED

**Issue:** Camp Admins (users with camp-lead role in roster) were blocked from uploading camp profile photos with error: "Only the camp account can perform this action"

**Root Cause:** **IDENTITY-TYPE MISMATCH** - The `requireCampAccount` middleware was using identity-based authorization (checking if `accountType === 'camp'` and `user._id === campId`) instead of association-based authorization (checking if user has Camp Admin privileges via roster membership).

---

## 🔍 EXACT PROBLEM LOCATION

**File:** `server/middleware/auth.js` (lines 195-227)

**Original Broken Logic:**
```javascript
const requireCampAccount = async (req, res, next) => {
  // ...
  
  // Check if user is camp account uploading for themselves
  if (req.user.accountType === 'camp' && req.user._id.toString() === campId.toString()) {
    return next();
  }
  
  // ❌ REJECTS Camp Admins here - they have accountType='personal', not 'camp'
  return res.status(403).json({ message: 'Only the camp account can perform this action' });
};
```

**Problem:** This only allowed:
1. ✅ System admins
2. ✅ Camp accounts where `user._id === campId`
3. ❌ **BLOCKED Camp Admins** (personal accounts with camp-lead role in roster)

---

## 🔍 AUTHORIZATION INCONSISTENCY

**Camp Profile Editing** (`PUT /api/camps/:id`) uses:
```javascript
const isOwner = await canAccessCamp(req, camp._id);  // Camp account
const isAdmin = await db.findMember({                // Camp Admin via roster
  user: req.user._id, 
  camp: camp._id, 
  role: 'camp-lead',
  status: 'active'
});

if (!isOwner && !isAdmin) {
  return res.status(403).json({ message: 'Not authorized' });
}
```

**Camp Photo Upload** (`POST /upload/camp-photo/:campId`) was using:
```javascript
requireCampAccount  // ❌ Only checked camp account, NOT Camp Admins
```

**Result:** Same user could edit camp profile but NOT upload photos - inconsistent authorization!

---

## ✅ FIX IMPLEMENTED

**File:** `server/middleware/auth.js` - Updated `requireCampAccount` middleware

**New Authorization Logic:**
```javascript
const requireCampAccount = async (req, res, next) => {
  // 1. System admin bypass
  const admin = await Admin.findOne({ user: req.user._id, isActive: true });
  if (admin) {
    return next();  // ✅ System admins can do anything
  }

  // 2. Camp account check (identity-based)
  const { canAccessCamp } = require('../utils/permissionHelpers');
  const isCampOwner = await canAccessCamp(req, campId);
  if (isCampOwner) {
    return next();  // ✅ Camp account for own camp
  }

  // 3. Camp Admin check (association-based) ← NEW!
  const db = require('../database/databaseAdapter');
  const campLead = await db.findMember({ 
    user: req.user._id, 
    camp: campId, 
    role: 'camp-lead',
    status: 'active'
  });
  
  if (campLead) {
    return next();  // ✅ Camp Admin (camp-lead role in roster)
  }

  // ❌ Reject if none of the above
  return res.status(403).json({ 
    message: 'Access denied. You must be the camp account or a Camp Admin for this camp.' 
  });
};
```

---

## 📊 AUTHORIZATION MATRIX (After Fix)

| User Type | Account Type | Condition | Can Upload? | Before | After |
|-----------|--------------|-----------|-------------|--------|-------|
| **System Admin** | `admin` | No campId | ✅ YES | ✅ YES | ✅ YES |
| **Camp Account** | `camp` | Own camp (`user._id === campId`) | ✅ YES | ✅ YES | ✅ YES |
| **Camp Admin** | `personal` | Roster member with `camp-lead` role | ✅ YES | ❌ NO | ✅ YES |
| **Project Lead** | `personal` | Roster member with `project-lead` role | ❌ NO | ❌ NO | ❌ NO |
| **Camp Member** | `personal` | Roster member with `member` role | ❌ NO | ❌ NO | ❌ NO |
| **Non-member** | `personal` | Not in roster | ❌ NO | ❌ NO | ❌ NO |

---

## 🔐 CORRECTED AUTHORIZATION RULE

### Pseudocode:

```javascript
function canUploadCampPhoto(user, targetCampId) {
  // 1. System admin bypass
  if (isSystemAdmin(user)) {
    return true;
  }
  
  // 2. Camp account (identity-based check)
  if (user.accountType === 'camp' && user._id === targetCampId) {
    return true;
  }
  
  // 3. Camp Admin (association-based check)
  const campLead = findMember({
    user: user._id,
    camp: targetCampId,
    role: 'camp-lead',
    status: 'active'
  });
  
  if (campLead) {
    return true;  // ✅ User is Camp Admin
  }
  
  return false;
}
```

### Key Principle:

**Association-Based Authorization** (correct):
- User is **associated** with camp via roster membership
- User has **camp-lead role** in that association
- ✅ Allows Camp Admins (personal accounts with elevated privileges)

**NOT Identity-Type-Based Authorization** (incorrect):
- User must have `accountType === 'camp'`
- User's `_id` must match `campId`
- ❌ Blocks Camp Admins (personal accounts managing camps)

---

## ✅ VERIFICATION FOR UID 69559af0c6168c32100f6c8d

**User ID:** `69559af0c6168c32100f6c8d`

**Before Fix:**
```
User: 69559af0c6168c32100f6c8d
Account Type: personal  ← NOT 'camp'
Upload Request: POST /upload/camp-photo/:campId
Middleware: requireCampAccount
Check 1: System admin? → NO
Check 2: Camp account (user._id === campId)? → NO (accountType='personal')
Check 3: Camp Admin? → NOT CHECKED ❌
Result: 403 "Only the camp account can perform this action"
```

**After Fix:**
```
User: 69559af0c6168c32100f6c8d
Account Type: personal
Upload Request: POST /upload/camp-photo/:campId
Middleware: requireCampAccount (UPDATED)
Check 1: System admin? → NO
Check 2: Camp account (user._id === campId)? → NO (accountType='personal')
Check 3: Camp Admin? → YES (if user has camp-lead role for campId) ✅
Result: 200 OK - Photo uploaded successfully
```

**Confirmation:** ✅ User `69559af0c6168c32100f6c8d` will now succeed IF they have:
- Valid JWT token
- Active roster membership for the target camp
- `camp-lead` role in that roster

---

## 🔄 CONSISTENCY WITH CAMP PROFILE EDITING

**Camp Profile Edit** (`PUT /api/camps/:id`):
```javascript
const isOwner = await canAccessCamp(req, camp._id);
const isAdmin = await db.findMember({ 
  user: req.user._id, 
  camp: camp._id, 
  role: 'camp-lead',
  status: 'active'
});

if (!isOwner && !isAdmin) {
  return res.status(403).json({ message: 'Not authorized' });
}
```

**Camp Photo Upload** (`POST /upload/camp-photo/:campId`) - NOW MATCHES:
```javascript
const isCampOwner = await canAccessCamp(req, campId);
const campLead = await db.findMember({ 
  user: req.user._id, 
  camp: campId, 
  role: 'camp-lead',
  status: 'active'
});

if (!isCampOwner && !campLead) {
  return res.status(403).json({ message: 'Access denied' });
}
```

**Result:** ✅ **IDENTICAL AUTHORIZATION RULES** - Consistent across both endpoints!

---

## 📋 FILES MODIFIED

1. ✅ `server/middleware/auth.js`
   - Updated `requireCampAccount` middleware
   - Added Camp Admin check (camp-lead role)
   - Changed from identity-based to association-based authorization
   - Updated error message to be more accurate

---

## 🧪 TESTING

### Test Case 1: Camp Admin (camp-lead role) ✅

**Setup:**
- User: `69559af0c6168c32100f6c8d` (or any personal account)
- Account Type: `personal`
- Roster Membership: Active member with `camp-lead` role
- Camp: Target campId

**Expected:**
```bash
POST /upload/camp-photo/:campId
Authorization: Bearer JWT_TOKEN

Response: 200 OK
{
  "message": "Camp photo uploaded successfully",
  "photo": { "url": "...", ... }
}
```

**Console Log:**
```
✅ [requireCampAccount] Camp Admin (camp-lead) authorized: 69559af0c6168c32100f6c8d
```

---

### Test Case 2: Camp Account ✅

**Setup:**
- User: Camp account where `user._id === campId`
- Account Type: `camp`

**Expected:** ✅ 200 OK

---

### Test Case 3: Project Lead (NOT Camp Lead) ❌

**Setup:**
- User: Personal account
- Roster Membership: Active member with `project-lead` role (NOT `camp-lead`)

**Expected:**
```bash
Response: 403 Forbidden
{
  "message": "Access denied. You must be the camp account or a Camp Admin for this camp."
}
```

---

### Test Case 4: Camp Member (Regular Member) ❌

**Setup:**
- User: Personal account
- Roster Membership: Active member with `member` role

**Expected:** ❌ 403 Forbidden

---

## 🔍 ROOT CAUSE SUMMARY

**Type:** Identity-type mismatch (NOT role issue)

**Problem:** Middleware checked `accountType === 'camp'` (identity) instead of roster association with elevated role (association)

**Impact:** Camp Admins (personal accounts with camp-lead role) were blocked even though they could edit camp profiles

**Fix:** Changed from identity-based to association-based authorization, matching camp profile edit authorization

**Result:** Camp photo upload authorization now matches camp profile edit authorization exactly

---

## 📖 EXACT CODE LOCATIONS CHANGED

**File:** `server/middleware/auth.js`

**Lines Changed:** 195-239

**Key Changes:**
1. Line 217: Added `canAccessCamp` import
2. Lines 224-233: Added Camp Admin check (camp-lead role)
3. Line 235: Updated error message

**Before:**
- Only checked: System admin OR Camp account
- Blocked: Camp Admins (personal accounts)

**After:**
- Checks: System admin OR Camp account OR Camp Admin (camp-lead role)
- Allows: All users who can edit camp profiles

---

## ✅ FINAL AUTHORIZATION RULE

```javascript
function canUploadCampPhoto(user, targetCampId) {
  return (
    isSystemAdmin(user) ||
    (isCampAccount(user) && user._id === targetCampId) ||
    isCampAdmin(user, targetCampId)  // ← NEW: association-based check
  );
}

function isCampAdmin(user, campId) {
  const member = findMember({
    user: user._id,
    camp: campId,
    role: 'camp-lead',
    status: 'active'
  });
  return !!member;
}
```

**Rule:** User can upload camp photos if they can edit camp profiles (identical authorization)

---

## 🎯 CONFIRMATION

**User ID:** `69559af0c6168c32100f6c8d`

**Will Succeed If:**
- ✅ User is authenticated (valid JWT)
- ✅ User has active roster membership for target camp
- ✅ User has `camp-lead` role in that roster
- ✅ User is uploading for the camp they have admin access to

**Will Fail If:**
- ❌ User is not authenticated
- ❌ User is not in roster for target camp
- ❌ User has `project-lead` or `member` role (not `camp-lead`)
- ❌ User tries to upload for different camp

---

**Status:** ✅ **FIXED - AUTHORIZATION MODEL CORRECTED**  
**Date:** December 31, 2025  
**Type:** Identity-type mismatch → Association-based authorization  
**Consistency:** Now matches camp profile edit authorization exactly

