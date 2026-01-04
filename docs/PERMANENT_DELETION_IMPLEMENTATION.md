# Permanent Account Deletion Implementation

## Overview

This document describes the implementation of the **Permanent Account Deletion** feature for both CAMP and MEMBER accounts. This feature provides irreversible deletion with specific data-handling rules for each account type.

---

## Feature Summary

### What Changed

1. **UI Label**: "Delete Users (Soft)" → "Permanently Delete"
2. **Deletion Behavior**: Soft delete (deactivation) → **Permanent deletion** (irreversible)
3. **Account-Specific Logic**: Different handling for CAMP vs MEMBER accounts
4. **Confirmation Warnings**: Added multi-level warnings for permanent actions

---

## Account-Specific Deletion Behavior

### CAMP Account Deletion

When a CAMP account is permanently deleted:

✅ **What Gets Deleted:**
- The CAMP user account itself (from `users` collection)
- User can sign up again with the same email

❌ **What Gets Preserved:**
- Camp profile
- Roster data
- Applications
- Events
- Shifts
- Tasks
- All camp-related entities remain accessible to other camp admins

**Rationale**: Camp entities represent collective data that should persist even if the account owner leaves. Other admins can continue managing the camp.

### MEMBER Account Deletion

When a MEMBER account is permanently deleted:

✅ **What Gets Deleted:**
- The MEMBER user account itself (from `users` collection)
- User can sign up again with the same email

🔄 **What Gets Transferred/Updated:**

1. **Tasks**:
   - Tasks assigned to member → Assigned user set to `null`, name becomes "Unknown User"
   - Tasks created by member → Ownership transfers to associated camp
   - Tasks watched by member → Member removed from watchers array
   - All tasks remain visible under camp's task list

2. **Roster Entries**:
   - Member name replaced with "Unknown User"
   - Email replaced with "deleted@example.com"
   - Other roster data preserved (dues status, travel plans, etc.)

3. **Applications**:
   - Application marked with `applicantDeleted: true`
   - Applicant name set to "Unknown User"
   - Applicant email set to "deleted@example.com"
   - Application history preserved

4. **Member Records**:
   - Name replaced with "Unknown User"
   - Email replaced with "deleted@example.com"
   - Record marked with `deletedAt` timestamp

**Rationale**: Member data is intertwined with camp operations. Replacing names with "Unknown User" maintains data integrity while removing personal information.

---

## Implementation Details

### Backend Service

**File**: `server/services/permanentDeletionService.js`

#### Main Functions

1. **`permanentlyDeleteAccount(userId, adminId)`**
   - Routes to appropriate handler based on account type
   - Returns: `{success, message, details}`

2. **`permanentlyDeleteCampAccount(userId, adminId)`**
   - Deletes user account only
   - Logs deletion activity for camp
   - Preserves all camp entities
   - Returns: `{success, message, campId, email}`

3. **`permanentlyDeleteMemberAccount(userId, adminId)`**
   - Deletes user account
   - Transfers/updates all associated tasks
   - Updates roster entries to "Unknown User"
   - Updates applications to "Unknown User"
   - Updates member records to "Unknown User"
   - Logs deletion activity
   - Returns: `{success, message, email, tasksTransferred}`

#### Task Transfer Logic

```javascript
// For each task associated with member:
if (task.createdBy === userId) {
  task.createdBy = camp.owner; // Transfer to camp
}
if (task.assignedTo === userId) {
  task.assignedTo = null;
  task.assignedToName = 'Unknown User';
}
if (task.watchers.includes(userId)) {
  task.watchers.remove(userId);
}
```

### Backend API Endpoint

**File**: `server/routes/admin.js`

**Endpoint**: `POST /api/admin/users/bulk-action`

**Updated Logic**:
```javascript
case 'delete':
  const deletionResult = await permanentlyDeleteAccount(userId, req.user._id);
  if (deletionResult.success) {
    results.push({
      userId,
      success: true,
      action: 'permanently deleted',
      details: deletionResult.message,
      email: deletionResult.email,
      tasksTransferred: deletionResult.tasksTransferred
    });
  }
  break;
```

### Frontend UI

**File**: `client/src/pages/admin/AdminDashboard.tsx`

#### Changes Made

1. **Dropdown Label**:
   ```tsx
   <option value="delete">Permanently Delete</option>
   ```

2. **Confirmation Dialog**:
   ```javascript
   if (bulkAction === 'delete') {
     const confirmed = window.confirm(
       `⚠️ PERMANENT DELETION WARNING ⚠️\n\n` +
       `You are about to PERMANENTLY DELETE ${selectedUsers.length} user account(s).\n\n` +
       `This action is IRREVERSIBLE...`
     );
     if (!confirmed) return;
   }
   ```

3. **Warning Banner**:
   - Red background for delete action
   - Explicit warning text about irreversibility
   - Different behavior for CAMP vs MEMBER accounts

---

## Safety Features

### Multi-Level Confirmation

1. **Selection**: Admin must explicitly select users
2. **Action Selection**: Admin must choose "Permanently Delete" from dropdown
3. **Warning Banner**: Visual warning in modal with red background
4. **Confirmation Dialog**: Browser confirm dialog with detailed warning
5. **Execution**: Only proceeds if all confirmations accepted

### Audit Logging

All permanent deletions are logged:

**For CAMP Accounts**:
```javascript
recordActivity('CAMP', campId, adminId, 'ACCOUNT_DELETED', {
  field: 'userAccount',
  deletedUserId: userId,
  deletedEmail: user.email,
  deletionType: 'permanent',
  note: 'Camp user account permanently deleted. Camp entities preserved.'
});
```

**For MEMBER Accounts**:
```javascript
recordActivity('MEMBER', userId, adminId, 'ACCOUNT_DELETED', {
  field: 'userAccount',
  deletedEmail: memberEmail,
  deletedName: memberName,
  deletionType: 'permanent',
  tasksTransferred: tasksTransferred,
  note: 'Member account permanently deleted. Tasks transferred to camps.'
});
```

### Data Integrity

- **No orphaned foreign keys**: All references are either deleted or updated
- **Referential integrity**: Tasks, rosters, applications maintain valid state
- **Cascading updates**: All related entities are updated in a single transaction
- **Error handling**: Each entity update is wrapped in try-catch

---

## Testing Checklist

### CAMP Account Deletion

- [ ] Select a camp account in admin panel
- [ ] Click "Bulk Actions" → "Permanently Delete"
- [ ] Verify warning banner shows red background
- [ ] Verify confirmation dialog appears
- [ ] After deletion:
  - [ ] User account is deleted from database
  - [ ] Camp profile still exists
  - [ ] Roster data still exists
  - [ ] Applications still exist
  - [ ] Events still exist
  - [ ] Tasks still exist
  - [ ] Email can be used for new signup
  - [ ] Activity log shows deletion

### MEMBER Account Deletion

- [ ] Select a personal/member account in admin panel
- [ ] Ensure member has:
  - [ ] At least one task assigned
  - [ ] At least one task created
  - [ ] At least one task watched
  - [ ] At least one roster entry
  - [ ] At least one application
- [ ] Click "Bulk Actions" → "Permanently Delete"
- [ ] Verify warning banner shows red background
- [ ] Verify confirmation dialog appears
- [ ] After deletion:
  - [ ] User account is deleted from database
  - [ ] Tasks show "Unknown User" for assigned tasks
  - [ ] Task ownership transferred to camp
  - [ ] Member removed from task watchers
  - [ ] Roster entries show "Unknown User"
  - [ ] Applications show "Unknown User"
  - [ ] Email can be used for new signup
  - [ ] Activity log shows deletion and task transfers

### Bulk Deletion

- [ ] Select multiple users (mix of CAMP and MEMBER)
- [ ] Verify confirmation shows correct count
- [ ] Verify all accounts processed correctly
- [ ] Verify results show success/failure for each

---

## Database Schema Updates

### MemberApplication Model

Added fields for deleted applicants:
```javascript
applicantDeleted: {
  type: Boolean,
  default: false
},
applicantName: {
  type: String
},
applicantEmail: {
  type: String
}
```

### Task Model

Added field for deleted assignee name:
```javascript
assignedToName: {
  type: String
}
```

### Member Model

Added deletion timestamp:
```javascript
deletedAt: {
  type: Date
}
```

---

## Error Handling

### Service Level

```javascript
try {
  // Deletion logic
  return { success: true, message: '...' };
} catch (error) {
  console.error('Error:', error);
  return { success: false, message: error.message };
}
```

### API Level

```javascript
for (const userId of userIds) {
  try {
    const result = await permanentlyDeleteAccount(userId, adminId);
    if (result.success) {
      results.push({ userId, success: true, ... });
    } else {
      actionErrors.push({ userId, error: result.message });
    }
  } catch (error) {
    actionErrors.push({ userId, error: error.message });
  }
}
```

### Frontend Level

```javascript
try {
  const response = await apiService.post('/admin/users/bulk-action', ...);
  // Refresh data
  await loadUsers();
} catch (error) {
  console.error('Error performing bulk action:', error);
  // User sees error in UI
}
```

---

## Rollback Plan

If issues arise, you can:

1. **Revert Backend Service**:
   - Delete `server/services/permanentDeletionService.js`
   - Restore old `case 'delete'` logic in `server/routes/admin.js`

2. **Revert Frontend**:
   - Change label back to "Delete Users (Soft)"
   - Remove confirmation dialog logic
   - Restore yellow warning banner

3. **Database Migrations** (if needed):
   - No schema changes were required
   - No data migration needed
   - Deletions are permanent (cannot be undone)

---

## Future Enhancements

### Potential Improvements

1. **Soft Delete Option**: Add back soft delete as a separate action
2. **Deletion Queue**: Implement delayed deletion with grace period
3. **Batch Processing**: Handle large deletions in background jobs
4. **Email Notifications**: Notify affected users before deletion
5. **Restore Capability**: Implement "undelete" for recent deletions
6. **Export Before Delete**: Auto-export user data before deletion
7. **Cascade Options**: Let admin choose what to preserve/delete

### Known Limitations

1. **No Undo**: Deletions are permanent and cannot be reversed
2. **Synchronous Processing**: Large batch deletions may timeout
3. **No Email Blacklist**: Deleted emails can immediately re-register
4. **Task Ownership**: Transfers to camp owner, not other admins
5. **No Audit Trail for Tasks**: Task history doesn't show original creator

---

## Files Modified

### Backend
- ✅ `server/services/permanentDeletionService.js` (NEW)
- ✅ `server/routes/admin.js` (MODIFIED)

### Frontend
- ✅ `client/src/pages/admin/AdminDashboard.tsx` (MODIFIED)

### Documentation
- ✅ `PERMANENT_DELETION_IMPLEMENTATION.md` (NEW)

---

## Deployment Checklist

- [ ] Backend changes deployed to Railway
- [ ] Frontend changes deployed to Vercel
- [ ] Database indexes verified
- [ ] Activity logging tested
- [ ] Admin permissions verified
- [ ] Confirmation dialogs tested
- [ ] CAMP deletion tested
- [ ] MEMBER deletion tested
- [ ] Bulk deletion tested
- [ ] Documentation updated
- [ ] Team notified of new feature

---

## Support & Troubleshooting

### Common Issues

**Issue**: "User not found" error
- **Cause**: User already deleted or invalid ID
- **Solution**: Refresh user list and try again

**Issue**: "Account type not supported" error
- **Cause**: Trying to delete admin accounts
- **Solution**: Admin accounts cannot be bulk deleted

**Issue**: Tasks not showing "Unknown User"
- **Cause**: Task update failed
- **Solution**: Check server logs, manually update tasks

**Issue**: Deletion takes too long
- **Cause**: Many associated tasks/entities
- **Solution**: Delete in smaller batches

### Logging

All operations are logged with console output:
```
🗑️  [Permanent Deletion] Starting CAMP account deletion...
✅ [Permanent Deletion] CAMP user account deleted: email@example.com
✅ [Permanent Deletion] All camp entities preserved
```

Search logs for `[Permanent Deletion]` to trace deletion operations.

---

**Last Updated**: 2025-12-19
**Status**: ✅ Implemented and Ready for Testing

