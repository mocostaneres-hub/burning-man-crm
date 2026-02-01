# 🐛 CAMP LEAD ROLE GRANT - BUG DIAGNOSIS

**User Report**: Roster member "test 8" (ID: 697e4ba0396f69ce26591eb2) was granted Camp Lead role but:
1. Member disappeared from roster
2. Permissions did not reflect on their account

---

## 🔍 ROOT CAUSE ANALYSIS

### **ISSUE #1: `updateRoster` Uses `findByIdAndUpdate` Without `markModified`**

**Location**: `server/database/databaseAdapter.js`, line 346-353

**Code**:
```javascript
async updateRoster(rosterId, updateData) {
  if (this.useMongoDB) {
    const Roster = require('../models/Roster');
    return await Roster.findByIdAndUpdate(rosterId, updateData, { new: true });
  }
}
```

**Problem in `grant-camp-lead` endpoint** (`server/routes/rosters.js`, line 1685-1691):
```javascript
// Update the member entry to grant Camp Lead role
activeRoster.members[memberIndex] = {
  ...activeRoster.members[memberIndex],
  isCampLead: true
};

// Save the updated roster
await db.updateRoster(activeRoster._id, activeRoster);  // ❌ PROBLEM!
```

**Why This Fails**:
1. `activeRoster.members[memberIndex]` is modified in memory
2. `db.updateRoster` receives the **ENTIRE ROSTER OBJECT** as `updateData`
3. `findByIdAndUpdate(rosterId, updateData, { new: true })` tries to update with the entire roster
4. **Mongoose does NOT detect nested array changes** when using `findByIdAndUpdate` with an object
5. The `isCampLead: true` change is **LOST** because Mongoose doesn't know the `members` array was modified

**Comparison with Working Endpoints**:

✅ **DUES UPDATE** (line 990-994) - **WORKS CORRECTLY**:
```javascript
roster.members[memberIndex].duesStatus = duesStatus;
roster.markModified('members');  // ← CRITICAL!
await roster.save();  // ← Uses .save(), not findByIdAndUpdate
```

✅ **OVERRIDES UPDATE** (line 1242-1247) - **WORKS CORRECTLY**:
```javascript
roster.members[memberIndex].overrides.playaName = playaName;
roster.markModified('members');  // ← CRITICAL!
await roster.save();  // ← Uses .save(), not findByIdAndUpdate
```

❌ **GRANT CAMP LEAD** (line 1685-1691) - **BROKEN**:
```javascript
activeRoster.members[memberIndex].isCampLead = true;
await db.updateRoster(activeRoster._id, activeRoster);  // ❌ NO markModified, NO .save()
```

---

### **ISSUE #2: Member "Disappearing" from Roster**

**Likely Cause**: Frontend filtering issue or roster refetch issue.

**Investigation Needed**:
1. Check if `isCampLead` members are filtered out by `RosterFilters`
2. Check if roster refetch after grant is working
3. Check if there's a filter that hides Camp Leads

**Frontend Filter Code** (`MemberRoster.tsx`, line 760-813):
- ✅ No filter for `isCampLead` found in filter logic
- ✅ Filters are: dues, tickets, VP, EAP, strike, virgin, veteran, skills
- ⚠️ **BUT**: If the backend doesn't actually save `isCampLead`, the roster refetch might fail

---

### **ISSUE #3: Permissions Not Reflecting**

**Why Permissions Don't Work**:
1. `isCampLead` flag **was never actually saved** to the database (see Issue #1)
2. Permission helper `isCampLeadForCamp` checks `rosterEntry.isCampLead === true`
3. Since the flag is `false` in DB, permissions are denied

**Permission Helper Code** (`server/utils/permissionHelpers.js`, line 229-234):
```javascript
const isCampLead = rosterEntry.isCampLead === true;
const isApproved = rosterEntry.status === 'approved';
const hasAccess = isCampLead && isApproved;
```

**This means**:
- User logs in
- Backend fetches roster
- `rosterEntry.isCampLead` is `false` (not `true` because it was never saved)
- Permissions denied

---

## 🛠️ FIXES REQUIRED

### **FIX #1: Update `grant-camp-lead` to Use `markModified` and `.save()`**

**File**: `server/routes/rosters.js`, line 1685-1691

**Before**:
```javascript
// Update the member entry to grant Camp Lead role
activeRoster.members[memberIndex] = {
  ...activeRoster.members[memberIndex],
  isCampLead: true
};

// Save the updated roster
await db.updateRoster(activeRoster._id, activeRoster);
```

**After**:
```javascript
// Update the member entry to grant Camp Lead role
activeRoster.members[memberIndex].isCampLead = true;

// CRITICAL: Mark the members array as modified for Mongoose
activeRoster.markModified('members');
activeRoster.updatedAt = new Date();

// Save the updated roster directly (must use .save() for markModified to work)
await activeRoster.save();
console.log('✅ [GRANT CAMP LEAD] Role saved successfully');
```

---

### **FIX #2: Update `revoke-camp-lead` to Use `markModified` and `.save()`**

**File**: `server/routes/rosters.js`, line 1801-1807

**Before**:
```javascript
// Update the member entry to revoke Camp Lead role
activeRoster.members[memberIndex] = {
  ...activeRoster.members[memberIndex],
  isCampLead: false
};

// Save the updated roster
await db.updateRoster(activeRoster._id, activeRoster);
```

**After**:
```javascript
// Update the member entry to revoke Camp Lead role
activeRoster.members[memberIndex].isCampLead = false;

// CRITICAL: Mark the members array as modified for Mongoose
activeRoster.markModified('members');
activeRoster.updatedAt = new Date();

// Save the updated roster directly (must use .save() for markModified to work)
await activeRoster.save();
console.log('✅ [REVOKE CAMP LEAD] Role revoked successfully');
```

---

### **FIX #3: Add Verification After Save**

**Add after both grant and revoke saves**:
```javascript
// Verify the save worked
const verifyRoster = await db.findRoster({ _id: activeRoster._id });
const verifyMember = verifyRoster.members.find(m => {
  const memberId = typeof m.member === 'object' ? m.member._id.toString() : m.member.toString();
  return memberId === params.memberId;
});
console.log('🔍 [GRANT/REVOKE] Verified isCampLead after save:', verifyMember?.isCampLead);
```

---

## 📊 Expected Behavior After Fix

### **Grant Camp Lead**:
1. User clicks "Grant Camp Lead" on member "test 8"
2. Modal confirms action
3. API: `POST /api/rosters/member/697e4ba0396f69ce26591eb2/grant-camp-lead`
4. Backend:
   - ✅ Finds roster
   - ✅ Finds member in roster
   - ✅ Sets `isCampLead: true`
   - ✅ Calls `markModified('members')`
   - ✅ Saves with `.save()`
5. Frontend:
   - ✅ Refetches roster
   - ✅ Member still visible
   - ✅ Shows "🎖️ Lead" badge
6. Member logs in:
   - ✅ `isCampLeadForCamp` returns `true`
   - ✅ Can access roster management
   - ✅ Can manage applications
   - ✅ Cannot delete camp or change ownership

---

## 🧪 Testing Plan

1. **Test Grant**:
   - Grant Camp Lead to "test 8"
   - Check database directly: `db.rosters.find({ "members.member": ObjectId("697e4ba0396f69ce26591eb2") })`
   - Verify `isCampLead: true` in DB
   
2. **Test UI**:
   - Verify member stays visible in roster
   - Verify "🎖️ Lead" badge appears
   
3. **Test Permissions**:
   - Log in as "test 8"
   - Try to access `/camp/CAMP_ID/roster`
   - Should have access
   - Try to edit roster
   - Should work
   
4. **Test Revoke**:
   - Revoke Camp Lead from "test 8"
   - Check database: `isCampLead: false`
   - Log in as "test 8"
   - Should NOT have roster access

---

## 🚨 CRITICAL LEARNING

**NEVER use `db.updateRoster(rosterId, rosterObject)` for nested array changes!**

**Always use**:
```javascript
roster.members[index].field = newValue;
roster.markModified('members');
await roster.save();
```

This is the **SAME PATTERN** used successfully in:
- ✅ Dues updates
- ✅ Override updates
- ✅ All other roster member field changes

The Camp Lead endpoints were the **ONLY ONES** not following this pattern!

---

**Status**: Ready to implement fixes
**Impact**: HIGH - Breaks entire Camp Lead feature
**Complexity**: LOW - Just need to match existing pattern
