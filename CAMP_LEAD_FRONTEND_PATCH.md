# Camp Lead Frontend Integration - MemberRoster Component Updates

This document outlines the changes needed to integrate Camp Lead role management into the MemberRoster component.

## Required Imports

Add these imports at the top of the file:

```typescript
import CampLeadBadge from '../../components/badges/CampLeadBadge';
import CampLeadConfirmModal from '../../components/modals/CampLeadConfirmModal';
import { canAssignCampLeadRole } from '../../utils/permissions';
```

## State Variables

Add these state variables after the existing useState declarations:

```typescript
// Camp Lead role management
const [campLeadConfirmModal, setCampLeadConfirmModal] = useState<{
  isOpen: boolean;
  member: RosterMember | null;
  action: 'grant' | 'revoke';
}>({ isOpen: false, member: null, action: 'grant' });
const [campLeadLoading, setCampLeadLoading] = useState<string | null>(null);
```

## Update fetchMembers Function

In the `fetchMembers` function, update the member mapping to include `isCampLead`:

```typescript
const transformedMember = {
  _id: memberEntry.member?._id || memberEntry.member,
  member: memberEntry.member,
  user: memberEntry.member?.user,
  duesPaid: duesPaid,
  duesStatus: memberEntry.duesStatus || 'Unpaid',
  isCampLead: memberEntry.isCampLead || false, // ADD THIS LINE
  addedAt: memberEntry.addedAt,
  addedBy: memberEntry.addedBy,
  rosterStatus: memberEntry.status || 'active',
  overrides: memberEntry.overrides || {}
};
```

## Add Camp Lead Role Management Handlers

Add these handler functions after the existing handlers (e.g., after `handleConfirmDelete`):

```typescript
// Handle Camp Lead role toggle
const handleCampLeadToggle = (member: RosterMember, currentStatus: boolean) => {
  setCampLeadConfirmModal({
    isOpen: true,
    member,
    action: currentStatus ? 'revoke' : 'grant'
  });
};

// Confirm Camp Lead role change
const handleConfirmCampLeadChange = async () => {
  const { member, action } = campLeadConfirmModal;
  if (!member) return;

  try {
    setCampLeadLoading(member._id.toString());

    if (action === 'grant') {
      await api.grantCampLeadRole(member._id.toString());
    } else {
      await api.revokeCampLeadRole(member._id.toString());
    }

    // Update local state
    setMembers(prevMembers =>
      prevMembers.map(m =>
        m._id === member._id
          ? { ...m, isCampLead: action === 'grant' }
          : m
      )
    );

    // Show success message
    const memberName = (() => {
      const memberData = member.member || member;
      const user = typeof memberData.user === 'object' ? memberData.user : null;
      return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Member';
    })();

    alert(`${action === 'grant' ? 'Granted' : 'Revoked'} Camp Lead role ${action === 'grant' ? 'to' : 'from'} ${memberName}`);

    // Close modal
    setCampLeadConfirmModal({ isOpen: false, member: null, action: 'grant' });
  } catch (error: any) {
    console.error('Error updating Camp Lead role:', error);
    alert(error.response?.data?.message || `Failed to ${action} Camp Lead role`);
  } finally {
    setCampLeadLoading(null);
  }
};

// Close Camp Lead confirm modal
const handleCloseCampLeadModal = () => {
  if (!campLeadLoading) {
    setCampLeadConfirmModal({ isOpen: false, member: null, action: 'grant' });
  }
};
```

## Update Member Table Row

In the member table rendering (inside the `filteredMembers.map` loop), add the Camp Lead badge and role assignment UI.

### 1. Add Camp Lead Badge next to member name

Find where the member name is displayed (around line 945-950) and add:

```typescript
<div>
  <div className="flex items-center gap-2">
    <p className="font-medium text-sm text-gray-900">{userName}</p>
    {member.isCampLead && <CampLeadBadge size="sm" />}
  </div>
  <p className="text-xs text-gray-500">{user?.email}</p>
</div>
```

### 2. Add Camp Lead Role Assignment Checkbox

In the edit mode section (where the inline editing inputs are), add this new column after the Dues Status column:

```typescript
{/* Camp Lead Role (Main Admin Only) */}
{canEdit && canAssignCampLeadRole(authUser, campId || undefined) && (
  <td className="px-6 py-4 whitespace-nowrap">
    {isEditing ? (
      <div className="flex items-center justify-center">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={member.isCampLead || false}
            onChange={(e) => {
              e.preventDefault();
              handleCampLeadToggle(member, member.isCampLead || false);
            }}
            disabled={
              campLeadLoading === member._id.toString() ||
              member.rosterStatus !== 'approved'
            }
            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded disabled:opacity-50"
            title={
              member.rosterStatus !== 'approved'
                ? 'Member must be approved to become Camp Lead'
                : 'Grant or revoke Camp Lead role'
            }
          />
          <span className="ml-2 text-xs text-gray-600">Camp Lead</span>
        </label>
      </div>
    ) : (
      <div className="text-center">
        {member.isCampLead ? (
          <span className="text-xs text-orange-600 font-medium">✓ Lead</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>
    )}
  </td>
)}
```

### 3. Add Table Header for Camp Lead Column

In the table header (around line 910-920), add:

```typescript
{canEdit && canAssignCampLeadRole(authUser, campId || undefined) && (
  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
    Camp Lead
  </th>
)}
```

## Add Camp Lead Confirmation Modal

At the end of the component, before the closing tag, add:

```typescript
{/* Camp Lead Confirmation Modal */}
<CampLeadConfirmModal
  isOpen={campLeadConfirmModal.isOpen}
  onClose={handleCloseCampLeadModal}
  onConfirm={handleConfirmCampLeadChange}
  memberName={(() => {
    const member = campLeadConfirmModal.member;
    if (!member) return '';
    const memberData = member.member || member;
    const user = typeof memberData.user === 'object' ? memberData.user : null;
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Member';
  })()}
  action={campLeadConfirmModal.action}
  loading={!!campLeadLoading}
/>
```

## Type Updates

Update the RosterMember interface at the top of the file to include isCampLead:

```typescript
interface RosterMember extends Member {
  member?: Member;
  isCampLead?: boolean; // ADD THIS LINE
}
```

---

## Summary of Changes

1. ✅ Added imports for CampLeadBadge, CampLeadConfirmModal, and permission helpers
2. ✅ Added state for Camp Lead modal and loading
3. ✅ Updated member data transformation to include isCampLead
4. ✅ Added handlers for Camp Lead role assignment
5. ✅ Added Camp Lead badge display next to member names
6. ✅ Added Camp Lead checkbox in edit mode (Main Admin only)
7. ✅ Added Camp Lead column header
8. ✅ Added Camp Lead confirmation modal
9. ✅ Updated RosterMember interface

These changes enable:
- Viewing Camp Lead badges
- Assigning/revoking Camp Lead roles (Main Admin only)
- Confirmation modals with clear permission explanations
- Immediate UI updates after role changes
- Proper permission checks (only approved roster members can be Camp Leads)
