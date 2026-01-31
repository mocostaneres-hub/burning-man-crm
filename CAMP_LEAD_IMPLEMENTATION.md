# Camp Lead Role - Implementation Guide

**Status**: ✅ Backend Complete | ⏳ Frontend Pending  
**Date**: January 31, 2026

---

## 📋 Overview

The **Camp Lead** role enables Main Camp Admins to delegate operational responsibilities to trusted roster members with camp-scoped permissions. This allows camps to distribute workload while maintaining security and data integrity.

---

## 🎯 Key Concepts

### Role Hierarchy
```
System Admin (unchanged)
    └── Camp Owner/Admin (Main Admin)
            └── Camp Lead (NEW - delegated admin)
                    └── Camp Member
```

### Camp Lead Characteristics
- **Camp-scoped only**: Permissions apply to a single camp
- **Roster-based**: Must be an approved roster member
- **Delegated**: Assigned by Main Admin only
- **Non-destructive**: Cannot delete/archive rosters or camps
- **Role-restricted**: Cannot assign/revoke Camp Lead roles

---

## ✅ Backend Implementation (COMPLETE)

### 1. Data Model

**File**: `server/models/Roster.js`

```javascript
members: [{
  member: { type: ObjectId, ref: 'Member' },
  status: { type: String, enum: ['approved', 'pending', 'rejected'] },
  isCampLead: { 
    type: Boolean, 
    default: false 
    // Camp Lead role - delegated admin for this specific camp
  },
  // ... other fields
}]
```

### 2. Permission Helpers

**File**: `server/utils/permissionHelpers.js`

#### New Functions

**`isCampLeadForCamp(req, campId)`**
- Checks if user is a Camp Lead for specific camp
- Validates: roster membership + isCampLead=true + status='approved'
- Returns: boolean

**`canManageCamp(req, campId)`**
- Unified permission check for camp management
- Includes: Camp owners, system admins, AND Camp Leads
- Returns: boolean
- **Use this** for all camp management operations

**Updated Function**
- `canAccessCampResources()` - Now uses `canManageCamp()`

### 3. Middleware Updates

**File**: `server/middleware/auth.js`

**`requireCampAccount`** middleware updated:
- Now includes Camp Lead permission checks
- Uses `isCampLeadForCamp()` helper
- Maintains backward compatibility

### 4. API Endpoints

#### Grant Camp Lead Role
```
POST /api/rosters/member/:memberId/grant-camp-lead
Auth: Camp owners only
Body: None

Response:
{
  "message": "Camp Lead role granted successfully",
  "memberId": "123",
  "memberName": "John Doe",
  "isCampLead": true
}

Validations:
- Member must be on roster
- Member status must be 'approved'
- Member cannot already be a Camp Lead
- Only Main Camp Admin can grant

Side Effects:
- Updates roster.members[].isCampLead = true
- Sends email notification to member
- Logs 'grant_camp_lead' activity
```

#### Revoke Camp Lead Role
```
POST /api/rosters/member/:memberId/revoke-camp-lead
Auth: Camp owners only
Body: None

Response:
{
  "message": "Camp Lead role revoked successfully",
  "memberId": "123",
  "memberName": "John Doe",
  "isCampLead": false
}

Validations:
- Member must currently be a Camp Lead
- Only Main Camp Admin can revoke

Side Effects:
- Updates roster.members[].isCampLead = false
- NO email sent (per requirements)
- Logs 'revoke_camp_lead' activity
```

### 5. Updated Routes (Now Allow Camp Leads)

#### Roster Management
```
PUT /api/rosters/:rosterId/members/:memberId/overrides
- Edit member details (playaName, skills, etc.)

PATCH /api/roster/member/:memberId/dues
- Update dues status
```

#### Application Management
```
GET /api/applications/camp/:campId
- View all applications for camp

PUT /api/applications/:id/status
- Approve/reject applications
```

#### All Other Camp Resources
- Events (create, edit, delete)
- Shifts (create, assign)
- Tasks (full control)
- Camp metadata updates

**Permission Check Pattern**:
```javascript
const { canManageCamp } = require('../utils/permissionHelpers');
const hasPermission = await canManageCamp(req, campId);
if (!hasPermission) {
  return res.status(403).json({ 
    message: 'Camp owner or Camp Lead access required' 
  });
}
```

### 6. Email Notification

**File**: `server/services/emailService.js`

**`sendCampLeadGrantedEmail(user, camp)`**
- Professional, branded email
- Clear explanation of role
- Lists all permissions
- Lists all limitations
- Link to camp dashboard
- **Sent on grant only** (not on revoke)

### 7. Activity Logging

**Actions Logged**:
- `grant_camp_lead` - When role assigned
- `revoke_camp_lead` - When role removed

**Log Details**:
```javascript
{
  userId: adminUserId,
  action: 'grant_camp_lead',
  details: {
    memberId,
    memberName,
    memberEmail,
    campId
  }
}
```

---

## ⏳ Frontend Implementation (PENDING)

### Required UI Changes

#### 1. Roster View - Role Assignment

**Location**: Camp roster member list

**For Main Camp Admin Only**:
- Add "Camp Lead" checkbox in member edit mode
- Show only for approved roster members
- Checkbox states:
  - ✅ Checked = User is Camp Lead
  - ☐ Unchecked = Regular member

**Assignment Flow**:
```
1. Admin checks "Camp Lead" checkbox
2. Show confirmation modal:
   "Grant Camp Lead access to [Name]?
    
    This allows them to:
    - Manage roster data
    - Review applications
    - Update member details
    
    But NOT:
    - Delete rosters
    - Assign roles
    - Remove Camp Admin"
    
   [Cancel] [Grant Access]
   
3. On confirm → Call API:
   POST /api/rosters/member/:memberId/grant-camp-lead
   
4. On success:
   - Update UI immediately
   - Show success toast: "[Name] is now a Camp Lead"
   - Checkbox becomes checked
   - Badge appears next to name
```

**Revocation Flow**:
```
1. Admin unchecks "Camp Lead" checkbox
2. Show confirmation modal:
   "Revoke Camp Lead access from [Name]?
    
    They will lose admin permissions and revert to
    standard member access."
    
   [Cancel] [Revoke Access]
   
3. On confirm → Call API:
   POST /api/rosters/member/:memberId/revoke-camp-lead
   
4. On success:
   - Update UI immediately
   - Show success toast: "Camp Lead role revoked"
   - Checkbox becomes unchecked
   - Badge removed from name
```

#### 2. Role Badge Display

**Location**: Wherever roster members are shown

**Badge Design**:
```jsx
{member.isCampLead && (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
    🎖️ Lead
  </span>
)}
```

**Display Locations**:
- Roster member list
- Member cards/profiles
- Application queue (if reviewer is Camp Lead)
- Any admin view showing team members

#### 3. Navigation & Access

**For Camp Leads**:
- Show same top navigation as Camp Admins (for that camp)
- Access to:
  - ✅ Roster management
  - ✅ Application queue
  - ✅ Events management
  - ✅ Tasks & shifts
  - ✅ Camp analytics
  - ❌ Roster create/delete buttons (hide these)
  - ❌ Role assignment UI (hide this)

**Conditional Rendering Example**:
```jsx
const isCampLead = user.isCampLeadForCamp(campId); // Check via API or context
const isCampOwner = user.accountType === 'camp' && user.campId === campId;
const canManage = isCampOwner || isCampLead;

// Show destructive actions only to owners
{isCampOwner && (
  <button onClick={deleteRoster}>Delete Roster</button>
)}

// Show role assignment only to owners
{isCampOwner && (
  <div className="camp-lead-assignment">
    <input type="checkbox" checked={member.isCampLead} />
    Camp Lead
  </div>
)}

// Show management features to both
{canManage && (
  <button onClick={editMember}>Edit Member</button>
)}
```

#### 4. API Integration

**Check if User is Camp Lead**:
```javascript
// Option 1: Add to user context (recommended)
// In AuthContext or user profile API response
{
  user: {
    _id: "...",
    accountType: "personal",
    campLeadFor: ["campId1", "campId2"] // Array of camp IDs
  }
}

// Option 2: Check roster data
// When fetching roster, check if current user has isCampLead=true
const roster = await fetch(`/api/rosters/camp/${campId}`);
const currentUserEntry = roster.members.find(m => m.user._id === currentUser._id);
const isCampLead = currentUserEntry?.isCampLead === true;
```

**Frontend Helper Function**:
```javascript
// utils/permissions.js
export function canManageCamp(user, campId) {
  // Camp owner
  if (user.accountType === 'camp' && user.campId === campId) {
    return true;
  }
  
  // System admin
  if (user.accountType === 'admin' && !user.campId) {
    return true;
  }
  
  // Camp Lead
  if (user.campLeadFor && user.campLeadFor.includes(campId)) {
    return true;
  }
  
  return false;
}
```

---

## 🧪 Testing Checklist

### Backend Tests ✅ (Implemented)

- [x] Roster schema includes `isCampLead` field
- [x] `isCampLeadForCamp()` helper works correctly
- [x] `canManageCamp()` helper includes all permission types
- [x] Grant endpoint validates eligibility
- [x] Revoke endpoint validates current status
- [x] Email sent on grant
- [x] No email on revoke
- [x] Activity logged for both actions
- [x] Camp Leads can edit roster members
- [x] Camp Leads can view applications
- [x] Camp Leads can update application status
- [x] Main Admin can still do everything
- [x] Camp Leads cannot delete rosters
- [x] Camp Leads cannot assign roles

### Frontend Tests ⏳ (TODO)

- [ ] Checkbox appears in member edit (Main Admin only)
- [ ] Confirmation modal shows on check/uncheck
- [ ] API calls succeed (grant/revoke)
- [ ] Badge displays next to Camp Lead names
- [ ] Badge removed when role revoked
- [ ] Camp Lead sees admin navigation
- [ ] Camp Lead can edit member details
- [ ] Camp Lead can manage applications
- [ ] Camp Lead CANNOT see delete roster button
- [ ] Camp Lead CANNOT see role assignment UI
- [ ] Regular member does NOT see admin features
- [ ] Role persists across page refreshes
- [ ] Multiple Camp Leads can coexist

### End-to-End Tests ⏳ (TODO)

- [ ] Main Admin grants Camp Lead role
- [ ] Email received by new Camp Lead
- [ ] Camp Lead logs in and sees admin UI
- [ ] Camp Lead edits roster member
- [ ] Camp Lead approves application
- [ ] Camp Lead cannot delete roster
- [ ] Main Admin revokes Camp Lead role
- [ ] Ex-Camp Lead loses admin access immediately
- [ ] All changes logged in activity feed

---

## 🚨 Important Notes

### Security

1. **Server-side enforcement**: ALL permissions are enforced server-side. UI hiding is for UX only.

2. **Camp-scoped**: Camp Lead permissions apply ONLY to the assigned camp. A user can be:
   - Camp Lead for Camp A
   - Regular member for Camp B
   - Non-member for Camp C

3. **No self-assignment**: Users cannot grant themselves Camp Lead role (enforced by requiring Main Admin account type).

4. **Immutable operations**: Destructive operations (delete roster, delete camp, transfer ownership) remain with Main Admin only.

### Edge Cases Handled

1. **Member leaves roster**: If a Camp Lead is removed from roster, they lose Camp Lead access (validated on each request).

2. **Status change**: If a Camp Lead's status changes from 'approved', they lose access (validated in `isCampLeadForCamp()`).

3. **Multiple Camp Leads**: A camp can have multiple Camp Leads working simultaneously.

4. **Role revocation**: Immediate effect - no grace period needed.

### Performance Considerations

1. **Permission checks**: `isCampLeadForCamp()` queries the roster on each request. Consider caching if performance issues arise.

2. **Email delivery**: Async email sending doesn't block role assignment.

3. **Activity logging**: Fire-and-forget pattern ensures logging doesn't slow down operations.

---

## 📚 API Reference Summary

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/rosters/member/:memberId/grant-camp-lead` | Main Admin | Grant role |
| POST | `/api/rosters/member/:memberId/revoke-camp-lead` | Main Admin | Revoke role |
| PUT | `/api/rosters/:rosterId/members/:memberId/overrides` | Main Admin or Camp Lead | Edit member |
| PATCH | `/api/roster/member/:memberId/dues` | Main Admin or Camp Lead | Update dues |
| GET | `/api/applications/camp/:campId` | Main Admin or Camp Lead | View applications |
| PUT | `/api/applications/:id/status` | Main Admin or Camp Lead | Update application |

### Permission Helpers

| Function | Purpose | Returns |
|----------|---------|---------|
| `isCampLeadForCamp(req, campId)` | Check if user is Camp Lead for camp | boolean |
| `canManageCamp(req, campId)` | Check if user can manage camp (owner OR lead) | boolean |
| `canAccessCampResources(req, campId)` | Check any camp access (includes members) | boolean |

---

## 🎉 What's Next

### Immediate Actions

1. **Frontend Implementation**:
   - Add role assignment UI in roster view
   - Display Camp Lead badges
   - Update navigation for Camp Leads
   - Hide destructive actions from Camp Leads

2. **Testing**:
   - Manual QA of all flows
   - Verify permission enforcement
   - Test edge cases

3. **Documentation**:
   - Update user guide
   - Create Camp Lead onboarding doc
   - Update admin training materials

### Future Enhancements (Out of Scope)

- [ ] Role templates (preset permission levels)
- [ ] Time-limited Camp Lead assignments
- [ ] Camp Lead activity dashboard
- [ ] Bulk role assignment
- [ ] Custom permission granularity
- [ ] Camp Lead application process

---

## 📞 Support

If you encounter issues:

1. Check server logs for permission denials
2. Verify `isCampLead` field in roster data
3. Confirm user is on roster with status='approved'
4. Validate API responses with browser DevTools

**Common Issues**:
- "Access denied" → User not Camp Lead or Main Admin
- Badge not showing → `isCampLead` not in roster data
- Email not sent → Check email service logs
- Role not persisting → Roster update failed

---

**Implementation Status**: Backend 100% complete ✅ | Frontend 0% complete ⏳

**Files Changed** (Backend):
- `server/models/Roster.js`
- `server/utils/permissionHelpers.js`
- `server/middleware/auth.js`
- `server/routes/rosters.js`
- `server/routes/applications.js`
- `server/services/emailService.js`

**Committed**: Yes ✅  
**Deployed**: Pending (after frontend implementation)
