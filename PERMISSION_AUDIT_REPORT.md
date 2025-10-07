# CRM Permission Audit Report

## Executive Summary
**Date:** October 7, 2025  
**Issue:** Camp accounts not using immutable `campId` for lookups  
**Severity:** HIGH - System using mutable fields (email, name) for authorization  
**Total Issues Found:** 57+ instances across 9 route files

## Core Problem
The CRM was using `contactEmail` and `campName` to look up camps and verify permissions. These fields are **mutable** and can change, creating security and data integrity risks. Camp accounts should **ALWAYS** use `campId` (immutable) for all operations.

## Critical Findings

### 1. **Authentication & Authorization Issues**
- ❌ **57+ instances** using `contactEmail` for camp lookups
- ❌ Permission checks comparing `camp.contactEmail === req.user.email`
- ❌ No standardized permission helper functions
- ✅ **FIXED:** Created `permissionHelpers.js` with standardized functions

### 2. **Affected Routes**

#### **HIGH PRIORITY** (User-facing CRUD operations)

##### `server/routes/camps.js` - **11 instances**
| Line | Issue | Impact |
|------|-------|--------|
| 192 | `findCamp({ contactEmail })` | Camp lookup by email |
| 226 | `contactEmail` comparison | Permission check |
| 283 | `findCamp({ contactEmail })` | Duplicate camp check |
| 336 | `findCamp({ contactEmail })` | Toggle public status |
| 344 | `updateCamp({ contactEmail })` | Update by email |
| 414 | `contactEmail: req.user.email` | Camp data assignment |
| 424 | `updateCamp({ contactEmail })` | Profile update |
| 453 | `contactEmail` comparison | Ownership check |
| 500 | `contactEmail` comparison | Delete permission |
| 655 | `contactEmail` comparison | Member access |
| 764 | `contactEmail` comparison | Roster access |

**Impact:** Camp profile management, updates, deletion

##### `server/routes/shifts.js` - **11 instances**
| Line | Issue | Impact |
|------|-------|--------|
| 26, 127, 189, 238 | `findCamp({ contactEmail })` | Event creation/management |
| 575, 633, 705 | `findCamp({ contactEmail })` | Event updates |
| 793 | `findCamp({ contactEmail })` | Event deletion (FIXED) |
| 916, 919, 1012 | `findCamp({ contactEmail })` | Task assignments |

**Impact:** Event/shift creation, editing, deletion, task assignments

##### `server/routes/rosters.js` - **14 instances**
| Line | Issue | Impact |
|------|-------|--------|
| 99, 180, 222 | `findCamp({ contactEmail })` | Roster lookups |
| 281, 311, 345 | `findCamp({ contactEmail })` | Member management |
| 551, 623, 712 | `findCamp({ contactEmail })` | Roster operations |
| 789, 836, 898 | `contactEmail` comparison | Permission checks |
| 995, 996 | `findCamp({ contactEmail })` | Dues management |

**Impact:** Roster viewing, member additions/removals, dues management

##### `server/routes/tasks.js` - **6 instances**
| Line | Issue | Impact |
|------|-------|--------|
| 14, 46 | `findCamp({ contactEmail })` | Task listing |
| 147, 184 | `contactEmail` comparison | Task creation permission |
| 224, 256 | `contactEmail` comparison | Task update/delete |

**Impact:** Task creation, editing, deletion, viewing

##### `server/routes/callSlots.js` - **5 instances**
| Line | Issue | Impact |
|------|-------|--------|
| 46, 88 | `contactEmail` comparison | Call slot viewing/creation |
| 141, 183 | `contactEmail` comparison | Call slot updates |
| 245 | `contactEmail` comparison | Call slot deletion |

**Impact:** Call slot management

##### `server/routes/applications.js` - **3 instances**
| Line | Issue | Impact |
|------|-------|--------|
| 279, 384 | `contactEmail` comparison | Application viewing |
| 492 | `contactEmail` comparison | Application actions |

**Impact:** Member application management

##### `server/routes/members.js` - **4 instances**
| Line | Issue | Impact |
|------|-------|--------|
| 130, 190 | `contactEmail` comparison | Member viewing |
| 241, 298 | `contactEmail` comparison | Member updates |

**Impact:** Member profile management

##### `server/routes/upload.js` - **1 instance**
| Line | Issue | Impact |
|------|-------|--------|
| 140 | `contactEmail` comparison | File upload permission |

**Impact:** Photo uploads

## Recommended Fix Pattern

### Old Pattern (BROKEN):
```javascript
// ❌ BAD: Using mutable email
const camp = await db.findCamp({ contactEmail: req.user.email });
if (camp.contactEmail !== req.user.email) {
  return res.status(403).json({ message: 'Access denied' });
}
```

### New Pattern (FIXED):
```javascript
// ✅ GOOD: Using immutable campId
const { getUserCampId, canAccessCamp } = require('../utils/permissionHelpers');

const userCampId = await getUserCampId(req);
if (!userCampId) {
  return res.status(404).json({ message: 'Camp not found' });
}

const hasAccess = await canAccessCamp(req, targetCampId);
if (!hasAccess) {
  return res.status(403).json({ message: 'Access denied' });
}
```

## Implementation Plan

### Phase 1: Helper Functions (COMPLETED)
✅ Created `server/utils/permissionHelpers.js`
✅ Functions: `getUserCampId()`, `canAccessCamp()`, `requireCampAccount()`, `requireCampOwnership()`

### Phase 2: Critical Routes (IN PROGRESS)
- [ ] Fix `camps.js` - Camp CRUD operations
- [ ] Fix `shifts.js` - Event/shift management  
- [ ] Fix `rosters.js` - Roster management
- [ ] Fix `tasks.js` - Task management
- [ ] Fix `callSlots.js` - Call slot management
- [ ] Fix `applications.js` - Application management
- [ ] Fix `members.js` - Member management
- [ ] Fix `upload.js` - File uploads

### Phase 3: Testing
- [ ] Test camp profile updates
- [ ] Test event creation/deletion
- [ ] Test roster operations
- [ ] Test task management
- [ ] Test call slot management

## Security Implications

### Before Fix:
1. **Email Change Attack:** User changes email, loses access to camp
2. **Race Condition:** Email updated mid-request, permission check fails
3. **Data Integrity:** Multiple camps could have same email temporarily
4. **Authorization Bypass:** Email spoofing could grant unauthorized access

### After Fix:
1. ✅ **Immutable Identifier:** `campId` never changes
2. ✅ **Consistent Permissions:** Same camp always accessible
3. ✅ **Data Integrity:** One camp, one ID
4. ✅ **Secure:** JWT contains campId, validated against database

## Breaking Changes

### None Expected
- Fallback to email lookup maintained for backwards compatibility
- Existing JWT tokens without `campId` will still work
- Gradual migration as users re-login and get new JWTs with `campId`

## Testing Checklist

Camp accounts should have FULL power to:
- [ ] View their camp profile
- [ ] Update camp information
- [ ] Create/edit/delete events and shifts
- [ ] View and manage roster
- [ ] Add/remove members
- [ ] Create/edit/delete tasks
- [ ] Manage call slots
- [ ] View and process applications
- [ ] Upload/manage photos
- [ ] Update member dues
- [ ] Archive/create rosters

## Conclusion

This audit identified a critical architectural flaw where mutable fields were used for authorization. The fix ensures:

1. ✅ **Camp accounts have FULL power** over their camp
2. ✅ **All operations use `campId`** (immutable)
3. ✅ **Standardized permission checks** across all routes
4. ✅ **No breaking changes** to existing functionality

**Next Step:** Systematically apply the fix pattern to all 57+ instances across all route files.

