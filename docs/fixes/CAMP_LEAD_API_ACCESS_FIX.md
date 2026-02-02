# Camp Lead API Access Fix

**Date**: February 2, 2026  
**Status**: ✅ Fixed & Deployed  
**Priority**: CRITICAL  
**Commits**: `2d815ea`, `5780cae`, `399199a`

---

## Summary

Camp Leads could not access ANY camp data (roster, applications, tasks, events) due to broken permission helpers and inconsistent endpoint security checks.

---

## The Root Causes

### 1. Permission Helpers Were Fundamentally Broken

**File**: `server/utils/permissionHelpers.js`  
**Functions**: `isCampLeadForCamp()`, `isActiveRosterMember()`

#### The Bug

```javascript
// ❌ WRONG: Searching roster by User ID
const rosterEntry = activeRoster.members.find(entry => {
  let userId = entry.member?.user?._id; // member is just an ObjectId!
  return userId === currentUserId;
});
// Result: NEVER finds the user
```

#### Why It Failed

```javascript
// Roster schema stores MEMBER IDs, not USER IDs:
roster.members[] = {
  member: ObjectId(ref: 'Member'), // ← Stores Member ID!
  isCampLead: Boolean
}

// Member schema links Member → User:
Member = {
  _id: ObjectId,  // ← This is what's in the roster
  user: ObjectId  // ← User ID is nested here
}
```

The helpers were trying to compare User IDs directly against roster entries, but the roster only stores Member IDs. The `member` field was never populated, so `entry.member.user` was always `undefined`.

#### The Fix

```javascript
// ✅ CORRECT: Query Member first, then search roster by Member ID
const currentUserId = req.user._id.toString();

// Step 1: Find the Member record for this user
const Member = require('../models/Member');
const member = await Member.findOne({ user: currentUserId });

if (!member) return false;

// Step 2: Search roster using Member ID
const rosterEntry = activeRoster.members.find(entry => {
  if (!entry.member) return false;
  
  const memberId = typeof entry.member === 'object' && entry.member._id 
    ? entry.member._id.toString() 
    : entry.member.toString();
  
  return memberId === member._id.toString(); // Compare Member IDs!
});
```

---

### 2. Inconsistent API Endpoint Permission Checks

**Problem**: Some endpoints used `canManageCamp()` (correct), others used `canAccessCamp()` (wrong), and some manually checked `accountType` (also wrong).

#### Permission Helper Hierarchy

```javascript
// ✅ canManageCamp() - Includes Camp Leads
async function canManageCamp(req, targetCampId) {
  // 1. System admins
  if (req.user.accountType === 'admin' && !req.user.campId) return true;
  
  // 2. Camp owners
  const isCampOwner = await canAccessCamp(req, targetCampId);
  if (isCampOwner) return true;
  
  // 3. Camp Leads (delegated admin)
  const isCampLead = await isCampLeadForCamp(req, targetCampId);
  return isCampLead;
}

// ❌ canAccessCamp() - Camp owners ONLY
async function canAccessCamp(req, targetCampId) {
  // Only checks accountType === 'camp' or 'admin'
  // Does NOT check for Camp Leads!
  if (req.user.accountType !== 'camp' && req.user.accountType !== 'admin') {
    return false;
  }
  // ...
}
```

---

## Endpoints Fixed

### ✅ Applications Endpoint (Already Working)

**File**: `server/routes/applications.js`  
**Endpoint**: `GET /api/applications/camp/:campId`  
**Status**: Was already using `canManageCamp()` ✅

```javascript
const hasAccess = await canManageCamp(req, campId);
if (!hasAccess) {
  return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
}
```

---

### ✅ Roster Endpoint (Fixed in `5780cae`)

**File**: `server/routes/rosters.js`  
**Endpoint**: `GET /api/rosters/active`

#### Before (Broken)

```javascript
if (req.query.campId) {
  campId = req.query.campId;
  
  // ❌ WRONG: canAccessCamp() doesn't check Camp Leads
  const { canAccessCamp } = require('../utils/permissionHelpers');
  const hasAccess = await canAccessCamp(req, campId);
  if (!hasAccess) {
    return res.status(403).json({ message: 'Access denied to this camp' });
  }
}
```

#### After (Fixed)

```javascript
if (req.query.campId) {
  campId = req.query.campId;
  
  // ✅ CORRECT: canManageCamp() includes Camp Leads
  const { canManageCamp } = require('../utils/permissionHelpers');
  const hasAccess = await canManageCamp(req, campId);
  if (!hasAccess) {
    return res.status(403).json({ message: 'Access denied to this camp' });
  }
}
```

---

### ✅ Events/Shifts Endpoints (Fixed in `399199a`)

**File**: `server/routes/shifts.js`  
**Endpoints**:
- `GET /api/shifts/events`
- `GET /api/shifts/reports/per-person`
- `GET /api/shifts/reports/per-day`

#### Before (Broken)

```javascript
// ❌ WRONG: Manual accountType check, no Camp Lead support
if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
  return res.status(403).json({ message: 'Camp admin/lead access required' });
}

const campId = await getUserCampId(req);
// ...
```

#### After (Fixed)

```javascript
// ✅ CORRECT: Unified pattern for camp owners and Camp Leads
let campId;

// For camp owners/admins
if (req.user.accountType === 'camp' || (req.user.accountType === 'admin' && req.user.campId)) {
  campId = await getUserCampId(req);
  if (!campId) {
    return res.status(404).json({ message: 'Unable to determine camp context' });
  }
}
// For Camp Leads: get campId from query param + verify permissions
else if (req.query.campId) {
  const { canManageCamp } = require('../utils/permissionHelpers');
  const hasAccess = await canManageCamp(req, req.query.campId);
  if (!hasAccess) {
    return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
  }
  campId = req.query.campId;
} else {
  return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
}
```

---

### ✅ Tasks Endpoint (Already Working)

**File**: `server/routes/tasks.js`  
**Endpoint**: `GET /api/tasks/camp/:campId`  
**Status**: Was already using `canAccessCampResources()` which internally uses `canManageCamp()` ✅

```javascript
const hasAccess = await canAccessCampResources(req, campId);
if (!hasAccess) {
  return res.status(403).json({ message: 'Access denied' });
}
```

---

## Frontend Changes

### Query Parameter Pattern

All Camp Lead API calls now pass `campId` as a query parameter for backend verification:

```typescript
// Example: Roster
const rosterResponse = await api.get(`/rosters/active?campId=${campId}`);

// Example: Events
let url = '/shifts/events';
if (user?.isCampLead && user?.campLeadCampId) {
  url += `?campId=${user.campLeadCampId}`;
}
const response = await api.get(url);

// Example: Applications (campId in URL path)
const response = await api.get(`/applications/camp/${campId}`);
```

### Files Changed

1. **client/src/pages/members/MemberRoster.tsx** (Already fixed in previous commits)
   - `fetchMembers()`: Passes `?campId=${campId}` for Camp Leads

2. **client/src/pages/applications/ApplicationManagementTable.tsx** (Already fixed)
   - `fetchApplications()`: Uses `user.campLeadCampId` for Camp Leads

3. **client/src/pages/shifts/VolunteerShifts.tsx** (Fixed in `399199a`)
   - `loadEvents()`: Passes `?campId=${user.campLeadCampId}` for Camp Leads

4. **client/src/pages/camps/TaskManagement.tsx** (Already fixed)
   - `fetchCampData()`: Uses `user.campLeadCampId` for Camp Leads

---

## Testing Checklist

### ✅ Test User: "test 8" (Camp Lead for Mudskippers)
- Email: `lead8@g8road.com`
- Camp: Mudskippers (`68e43f61a8f6ec1271586306`)
- Role: Camp Lead (granted by camp owner)

### Results

| Feature | Before | After | Status |
|---------|--------|-------|--------|
| Navigation Links | ❌ Missing | ✅ Shows Camp Links | FIXED |
| Roster Page | ❌ Empty (403) | ✅ Shows Members | FIXED |
| Applications Page | ❌ Error (403) | ✅ Shows Apps | FIXED |
| Tasks Page | ❌ Loading Forever | ✅ Shows Tasks | FIXED |
| Events/Shifts Page | ❌ Error (403) | ✅ Shows Events | FIXED |

---

## Impact Analysis

### Before Fixes
- **100% of Camp Lead data access was broken**
- All 4 core features returned 403 Forbidden
- Camp Leads were functionally useless

### After Fixes
- **100% of Camp Lead features work correctly**
- All permission checks unified and consistent
- Camp Leads have full delegated admin access

---

## Lessons Learned

### 1. **Data Model Complexity**
- The roster stores Member IDs, not User IDs
- Permission helpers MUST query the Member table first
- Never assume roster entries are populated

### 2. **Inconsistent Patterns**
- Some endpoints used helper functions, others manual checks
- Standardizing on `canManageCamp()` ensures consistency
- Query parameter pattern (`?campId=`) is cleaner than JWT parsing

### 3. **Hidden Dependencies**
- Camp Lead feature depends on:
  - Correct Member → User resolution
  - Updated `/api/auth/me` enrichment
  - Frontend navigation detection
  - Page-level access checks
  - **API endpoint permission checks** ← This was the final blocker

### 4. **Testing Approach**
- Frontend worked, backend navigation worked, but API was broken
- Must test the FULL data flow: Frontend → Backend → Database → Response
- Console logs in permission helpers were crucial for debugging

---

## Related Documentation

- [Camp Lead Complete Feature](../features/CAMP_LEAD_COMPLETE.md)
- [Camp Lead Revocation Flow](../features/CAMP_LEAD_REVOCATION_FLOW.md)
- [Permission Helpers Source](../../server/utils/permissionHelpers.js)

---

## Deployment

**Commits**:
1. `2d815ea` - Fix permission helpers (isCampLeadForCamp, isActiveRosterMember)
2. `5780cae` - Fix roster endpoint (canAccessCamp → canManageCamp)
3. `399199a` - Fix events/shifts endpoints + frontend query params

**Status**: ✅ All commits pushed to `main` and deployed to Railway  
**Verified**: February 2, 2026 - All Camp Lead features working in production
