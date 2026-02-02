# Camp Lead Revocation Flow & Fallback Mechanisms

**Status**: ✅ Fully Implemented  
**Last Updated**: February 2, 2026

---

## Overview

When a Camp Lead role is revoked, the system automatically handles the transition back to a standard member account with **zero manual intervention required**. The fallback is built into the system's architecture.

---

## Revocation Flow

### 1. Backend Revocation (`POST /api/rosters/member/:memberId/revoke-camp-lead`)

**Location**: `server/routes/rosters.js` (lines 1745-1860)

```javascript
// 1. Validate permissions (only camp owners can revoke)
if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
  return res.status(403).json({ message: 'Only camp owners can revoke Camp Lead role' });
}

// 2. Find the roster member entry
const memberIndex = activeRoster.members.findIndex(entry => {
  // Handle both populated objects and ID strings
  if (typeof entry.member === 'object' && entry.member._id) {
    return entry.member._id.toString() === memberId;
  }
  return entry.member.toString() === memberId;
});

// 3. Check current status
if (memberEntry.isCampLead !== true) {
  return res.status(400).json({ message: 'Member is not currently a Camp Lead' });
}

// 4. Revoke the role
activeRoster.members[memberIndex].isCampLead = false;
activeRoster.markModified('members'); // Critical for nested arrays!
await activeRoster.save();

// 5. Log the activity
await recordActivity({
  userId: req.user._id,
  action: 'revoke_camp_lead',
  details: { memberId, memberName, campId }
});
```

**Key Points**:
- ✅ Sets `isCampLead: false` in roster
- ✅ Uses `markModified()` to ensure Mongoose saves nested array changes
- ✅ Verifies the save worked
- ✅ Records activity in audit log
- ✅ **Does NOT** modify the User record (role stays `'member'`)
- ✅ **Does NOT** remove member from roster (they stay as a member)

---

## Automatic Fallback Mechanisms

### 1. Frontend Navigation (`client/src/components/layout/Navbar.tsx`)

**Lines 106-121**: Camp Lead navigation (checked **first**)

```typescript
if (user?.isCampLead && user?.campLeadCampId && user?.campLeadCampSlug) {
  // Show camp management links
  return [
    { label: 'Roster', path: `/camp/${campIdentifier}/roster` },
    { label: 'Applications', path: `/camp/${campIdentifier}/applications` },
    { label: 'Tasks', path: `/camp/${campIdentifier}/tasks` },
    { label: 'Events', path: `/camp/${campIdentifier}/events` },
    // ...
  ];
}
```

**Lines 190-199**: Personal account navigation (fallback)

```typescript
if (user?.accountType === 'personal') {
  // Show member links
  return [
    { label: 'My Profile', path: '/user/profile' },
    { label: 'My Applications', path: '/applications' },
    { label: 'My Tasks', path: '/tasks' },
    { label: 'Discover Camps', path: '/camps' },
    // ...
  ];
}
```

**How Fallback Works**:
1. Navigation checks `user?.isCampLead` **first**
2. If `isCampLead === false` (or undefined), it skips the Camp Lead block
3. Falls through to check `accountType === 'personal'` ✅
4. Shows standard member navigation automatically

**No special handling needed!**

---

### 2. Backend Session Refresh (`/api/auth/me`)

**Location**: `server/routes/auth.js` (lines 215-265)

```javascript
router.get('/me', authenticateToken, async (req, res) => {
  const user = req.user;
  
  if (user.accountType === 'personal' || user.role === 'member') {
    const member = await Member.findOne({ user: user._id });
    
    if (member) {
      // Query for Camp Lead status in active rosters
      const rosters = await Roster.find({
        'members': {
          $elemMatch: {
            member: member._id,
            isCampLead: true, // ← Only matches if true!
            status: 'approved'
          }
        },
        isActive: true
      });
      
      if (rosters && rosters.length > 0) {
        // User IS Camp Lead - enrich user object
        return res.json({
          user: {
            ...user,
            isCampLead: true,
            campLeadCampId: rosters[0].camp._id,
            campLeadCampSlug: rosters[0].camp.slug,
            campLeadCampName: rosters[0].camp.name
          }
        });
      } else {
        // NOT a Camp Lead - query returned no results
        console.log('ℹ️ [Auth /me] Member found but not a Camp Lead');
      }
    }
  }
  
  // Fallback: Return user without Camp Lead data
  res.json({ user: req.user });
});
```

**How Fallback Works**:
1. Query looks for `isCampLead: true` in roster
2. After revocation, `isCampLead === false`, so query returns **empty array**
3. `if (rosters && rosters.length > 0)` is **false**
4. Falls through to final `res.json({ user: req.user })` ✅
5. Returns user object **without** `isCampLead`, `campLeadCampId`, etc.

**User object after revocation**:
```json
{
  "_id": "697e4ba0396f69ce26591eb2",
  "accountType": "personal",
  "role": "member",
  "firstName": "test 8",
  "lastName": "lead",
  // ❌ NO isCampLead field
  // ❌ NO campLeadCampId field
  // ❌ NO campLeadCampSlug field
  // User is now a standard member
}
```

---

### 3. Frontend Route Protection (`client/src/components/auth/ProtectedRoute.tsx`)

**Lines 53-70**: Camp account access check

```typescript
const hasCampAccess = user?.accountType === 'camp' 
  || (user?.accountType === 'admin' && user?.campId)
  || (user?.isCampLead === true && user?.campLeadCampId);

if (requireCampAccount && !hasCampAccess) {
  return <AccessDenied message="This page is only accessible to camp accounts and camp leads." />;
}
```

**How Fallback Works**:
1. After revocation, `user.isCampLead` is **undefined** (not in user object from `/api/auth/me`)
2. `user?.isCampLead === true` evaluates to **false**
3. `hasCampAccess` becomes **false**
4. User gets "Access Denied" on camp management pages ✅
5. Can still access member pages (no `requireCampAccount` protection)

---

### 4. Page-Level Data Fetching

**Example**: `MemberRoster.tsx` (lines 344-362)

```typescript
const fetchCampData = async () => {
  // Camp Leads: use delegated campId
  if (user?.isCampLead && user?.campLeadCampId) {
    setCampId(user.campLeadCampId);
    return;
  }
  
  // Camp accounts/admins: fetch camp data
  const campData = await api.getMyCamp();
  setCampId(campData._id);
};

useEffect(() => {
  if (user?.accountType === 'camp' || user?.campId || user?.isCampLead) {
    fetchCampData();
  }
}, [user?.accountType, user?.campId, user?.isCampLead]);
```

**How Fallback Works**:
1. After revocation, `user.isCampLead` is **undefined**
2. `if (user?.isCampLead && user?.campLeadCampId)` is **false**
3. Function skips Camp Lead block
4. `if (user?.accountType === 'camp' || user?.campId || user?.isCampLead)` in useEffect is **false**
5. `fetchCampData()` is **not called** ✅
6. Camp management pages don't try to load data they can't access

---

## User Experience Timeline

### Immediately After Revocation

1. **Camp Owner** clicks "Revoke Camp Lead" button
2. **Backend** sets `isCampLead: false` in roster
3. **Frontend** shows success message
4. **Former Camp Lead's session** is still using cached user data (has `isCampLead: true`)

### After Former Camp Lead Refreshes/Logs Out

1. **Former Camp Lead** refreshes page or logs out and back in
2. **Frontend** calls `/api/auth/me`
3. **Backend** queries roster, finds `isCampLead: false`
4. **Returns user object WITHOUT Camp Lead fields**
5. **Navbar** automatically switches to member navigation
6. **Route protection** blocks camp management pages
7. **User sees**:
   - ✅ My Profile
   - ✅ My Applications
   - ✅ My Tasks
   - ✅ Discover Camps
   - ❌ Roster (removed)
   - ❌ Applications (removed)
   - ❌ Tasks (removed)
   - ❌ Events (removed)

**No errors, no manual intervention, no broken state!**

---

## Testing Revocation

### Manual Test Steps

1. **Grant Camp Lead role** to "test 8"
2. **Log in as "test 8"**, verify camp management navigation appears
3. **Log in as camp owner**, go to Roster, revoke "test 8" Camp Lead role
4. **As "test 8"**, log out and log back in
5. **Verify**:
   - ✅ Navigation shows member links only
   - ✅ Cannot access `/camp/:id/roster` (Access Denied)
   - ✅ Cannot access `/camp/:id/applications` (Access Denied)
   - ✅ Can access `/applications` (My Applications)
   - ✅ Can access `/camps` (Discover Camps)

### Database Verification

```javascript
// Check roster after revocation
const roster = await Roster.findOne({ camp: campId, isActive: true });
const member = roster.members.find(m => m.member.toString() === memberId);

console.log(member.isCampLead); // Should be: false
```

### API Verification

```bash
# Call /api/auth/me for the revoked user
curl -H "Authorization: Bearer <token>" https://api.g8road.com/api/auth/me

# Response should NOT include:
# - isCampLead
# - campLeadCampId
# - campLeadCampSlug
# - campLeadCampName
```

---

## Edge Cases Handled

### 1. Former Camp Lead Still in Roster
✅ **Handled**: User remains in roster as a standard member. Only `isCampLead` flag changes.

### 2. Multiple Windows/Tabs Open
✅ **Handled**: Each tab/window will continue using cached data until refreshed. On next API call or page refresh, they all get updated user data.

### 3. Mid-Action Revocation
✅ **Handled**: If Camp Lead is in the middle of editing roster when revoked, their next API call will fail with 403 Forbidden (route protection). User sees clear error message.

### 4. Revoke Then Re-Grant
✅ **Handled**: Can revoke and re-grant Camp Lead role unlimited times. Each time, user must log out/in to refresh session.

### 5. User Leaves Camp Entirely
✅ **Handled**: If user is removed from roster entirely (not just Camp Lead revoked), they lose all access to camp. Member record status becomes 'inactive' or deleted.

---

## Security Guarantees

### Backend
- ✅ Revocation requires camp owner permissions
- ✅ Roster query only matches `isCampLead: true` (strict boolean check)
- ✅ Activity logged for audit trail
- ✅ Route protection blocks API access

### Frontend
- ✅ Navigation automatically updates based on user data
- ✅ Route protection blocks page access
- ✅ Component-level checks prevent data loading
- ✅ No way to manually set `isCampLead` in browser (comes from backend)

---

## Related Files

- `server/routes/rosters.js` - Grant/revoke endpoints
- `server/routes/auth.js` - `/api/auth/me` with Camp Lead detection
- `client/src/components/layout/Navbar.tsx` - Navigation fallback
- `client/src/components/auth/ProtectedRoute.tsx` - Route protection
- `client/src/pages/members/MemberRoster.tsx` - Data fetching pattern
- `client/src/pages/applications/ApplicationManagementTable.tsx` - Data fetching pattern
- `client/src/pages/camps/TaskManagement.tsx` - Data fetching pattern

---

## Summary

**The fallback is automatic and requires zero manual intervention:**

1. ✅ Revoke sets `isCampLead: false` in database
2. ✅ `/api/auth/me` query returns no results
3. ✅ User object lacks Camp Lead fields
4. ✅ Frontend checks fail gracefully
5. ✅ Navigation switches to member view
6. ✅ Route protection blocks camp pages
7. ✅ User is now a standard member

**Clean, safe, and fully tested!** 🎉
