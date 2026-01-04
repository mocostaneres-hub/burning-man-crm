# Roster-Based Access Control for Member Accounts

## Overview
This document describes the comprehensive access control system implemented for member (personal) accounts to access camp tasks and resources based on their active roster membership.

## Access Control Rules

### 1. **Camp Resource Access Hierarchy**
Access to camp tasks and resources is granted in the following priority order:

1. **System Admins** (accountType: 'admin', no campId)
   - Full access to all resources across all camps
   
2. **Camp Owners** (accountType: 'camp' or 'admin' with campId)
   - Full access to their own camp's resources
   - Can create, edit, delete, and manage all tasks
   
3. **Active Roster Members** (accountType: 'personal')
   - Full access to their camp's tasks as long as they're on the active roster
   - Can view, edit, and comment on all camp tasks
   - **Lose access immediately when removed from roster**
   
4. **Task Assignees** (regardless of roster status)
   - Can view and edit tasks they're assigned to
   - Can add comments to their assigned tasks
   
5. **Task Watchers** (regardless of roster status)
   - Can view and edit tasks they're watching
   - Can add comments to watched tasks

### 2. **Automatic Access Revocation**
When a member is removed from a camp's roster:
- They immediately lose access to all camp tasks
- Exception: Tasks they're specifically assigned to or watching remain accessible
- Their application status is updated to "withdrawn" to allow re-application

## Implementation Details

### New Helper Functions (`server/utils/permissionHelpers.js`)

#### `isActiveRosterMember(req, targetCampId)`
Checks if a personal account user is an active member of a camp's roster.

**Parameters:**
- `req`: Express request object with authenticated user
- `targetCampId`: The camp ID being checked

**Returns:** `Promise<boolean>`

**Logic:**
1. Only applies to personal accounts (returns false for camp/admin accounts)
2. Fetches the active roster for the specified camp
3. Checks if user's ID exists in the roster's members array
4. Returns true only if user is found in active roster

#### `canAccessCampResources(req, targetCampId)`
Comprehensive access check for camp resources (tasks, rosters, etc.).

**Parameters:**
- `req`: Express request object with authenticated user
- `targetCampId`: The camp ID being accessed

**Returns:** `Promise<boolean>`

**Grants Access If:**
- User is a system admin (admin without campId)
- User is camp owner (canAccessCamp returns true)
- User is an active roster member (isActiveRosterMember returns true)

### Updated Endpoints

All task-related endpoints now use `canAccessCampResources()` for permission checks:

#### `GET /api/tasks/code/:taskIdCode`
- Access: Camp owners, active roster members, assignees, or watchers
- Returns single task with full details

#### `GET /api/tasks/camp/:campId`
- Access: Camp owners or active roster members
- Returns all tasks for the specified camp

#### `PUT /api/tasks/:id`
- Access: Camp owners, active roster members, assignees, or watchers
- Updates task details and tracks changes in history

#### `POST /api/tasks/:id/comments`
- Access: Camp owners, active roster members, assignees, or watchers
- Adds a new comment to the task

#### `GET /api/tasks/:id/comments`
- Access: Camp owners, active roster members, assignees, or watchers
- Retrieves all comments for a task

## Database Schema

### Roster Schema
```javascript
{
  camp: ObjectId,           // Reference to Camp
  name: String,             // Roster name (e.g., "2025 Roster")
  isActive: Boolean,        // Only one active roster per camp
  isArchived: Boolean,      // Archived rosters
  members: [{
    member: ObjectId,       // Reference to Member
    status: String,         // 'approved', 'pending', 'rejected'
    role: String,           // 'member', 'lead', 'admin'
    addedAt: Date,
    addedBy: ObjectId
  }],
  createdBy: ObjectId
}
```

### Key Constraints
- Only one active roster per camp (enforced by unique index)
- Access checks always use the active roster
- Archived rosters don't grant access

## User Experience

### For Active Roster Members:
✅ Can view all camp tasks
✅ Can edit any camp task
✅ Can comment on any camp task
✅ Can be assigned to tasks
✅ Can be added as watchers

### After Removal from Roster:
❌ Cannot view camp's general tasks
❌ Cannot access camp task management
❌ Cannot comment on camp tasks
✅ Can still access tasks they're specifically assigned to
✅ Can still access tasks they're watching
✅ Can re-apply to the camp (application status set to "withdrawn")

## Testing Scenarios

### Scenario 1: Active Member Access
1. Personal account is added to camp roster (status: 'approved')
2. Member can now access `/camp/tasks` and view all tasks
3. Member can edit tasks, add comments, etc.

### Scenario 2: Member Removal
1. Camp lead removes member from roster
2. Member's application status changes to "withdrawn"
3. Member immediately loses access to camp tasks
4. Exception: Tasks where member is assigned/watching remain accessible

### Scenario 3: Task-Specific Access
1. Member is removed from roster
2. Member is assigned to Task A
3. Member can still access Task A directly via `/tasks/:taskIdCode`
4. Member cannot access other camp tasks

### Scenario 4: Re-Application
1. Member is removed from roster
2. Application status is set to "withdrawn"
3. Member can now reapply to the camp
4. Upon re-approval, full access is restored

## Security Considerations

1. **Permission checks happen on every request** - No caching of permissions
2. **Active roster lookup** - Always checks current roster state
3. **No stale access** - Removal from roster is effective immediately
4. **Task-level overrides** - Assigned/watcher status provides continued access
5. **Audit trail** - All task changes tracked in history with user ID

## Future Enhancements

1. **Role-based permissions within roster** - Different access levels for 'member', 'lead', 'admin'
2. **Time-limited access** - Temporary roster members
3. **Read-only access** - View tasks without edit permissions
4. **Notification system** - Alert members when they lose access
5. **Access logs** - Track when members access tasks

## Related Files

- `server/utils/permissionHelpers.js` - Access control helper functions
- `server/routes/tasks.js` - Task endpoints with roster checks
- `server/routes/rosters.js` - Roster management endpoints
- `server/models/Roster.js` - Roster database schema
- `server/database/databaseAdapter.js` - Database operations

