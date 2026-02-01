# 🔧 CAMP LEAD NAVIGATION - COMPREHENSIVE FIX PLAN

**User Requirements**:
1. ❌ Nothing changed after granting Camp Lead role
2. ❌ Frontend doesn't detect Camp Lead status
3. ❌ Navigation doesn't update for Camp Leads

---

## 🎯 REQUIRED BEHAVIOR

### **When User is Granted Camp Lead Role**:

**Navigation SHOULD show** (same as camp accounts):
- ✅ **Roster** → View/manage their camp's roster
- ✅ **Applications** → Full access to camp applications
- ✅ **Tasks** → Full access to camp tasks
- ✅ **Events** → Full access to camp events/shifts

**Navigation SHOULD hide** (member-only links):
- ❌ **My Applications** (hidden)
- ❌ **Discover Camps** (hidden)

**Keep visible**:
- ✅ **My Profile** → Personal profile still accessible
- ✅ **My Tasks** → Personal tasks (if any)
- ✅ **Help**

---

## 🔍 ROOT CAUSE ANALYSIS

### **Issue #1: Backend Doesn't Return Camp Lead Status**

**Current Flow**:
1. User granted Camp Lead → `isCampLead: true` saved to roster
2. User logs in → `/api/auth/login` returns user object
3. `/api/auth/me` returns basic user data
4. **PROBLEM**: Neither endpoint checks if user is a Camp Lead!

**User Object**:
```javascript
{
  _id: "697e4ba0396f69ce26591eb2",
  accountType: "personal",  // ← Still personal!
  role: "member",           // ← Still member!
  // No camp lead info!
}
```

---

### **Issue #2: Frontend Navbar Only Checks `accountType`**

**Current Logic** (`Navbar.tsx`, line 99-161):
```javascript
// Camp/Admin accounts navigation
if (user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) {
  // Show: Roster, Applications, Tasks, Events
}

// Personal accounts navigation
if (user?.accountType === 'personal') {
  // Show: My Profile, My Applications, Discover Camps
}
```

**PROBLEM**: Camp Leads have `accountType: 'personal'` so they get member navigation!

---

## ✅ SOLUTION

### **Step 1: Enhance `/api/auth/me` to Return Camp Lead Status**

**File**: `server/routes/auth.js`, line 215

**BEFORE**:
```javascript
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});
```

**AFTER**:
```javascript
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Check if user is a Camp Lead in any roster
    if (user.accountType === 'personal' && user.role === 'member') {
      const { isCampLeadForCamp } = require('../utils/permissionHelpers');
      
      // Find all camps where user is Camp Lead
      const Roster = require('../models/Roster');
      const rosters = await Roster.find({
        'members': {
          $elemMatch: {
            'user': user._id,
            'isCampLead': true,
            'status': 'approved'
          }
        },
        isActive: true
      }).select('camp _id').populate('camp', 'name slug _id');
      
      if (rosters && rosters.length > 0) {
        // User is Camp Lead! Return first camp (users can only be lead in one camp)
        const campLeadCamp = rosters[0].camp;
        
        return res.json({
          user: {
            ...user.toObject ? user.toObject() : user,
            isCampLead: true,
            campLeadCampId: campLeadCamp._id.toString(),
            campLeadCampSlug: campLeadCamp.slug,
            campLeadCampName: campLeadCamp.name
          }
        });
      }
    }
    
    // Not a Camp Lead, return normal user
    res.json({ user: req.user });
  } catch (error) {
    console.error('Error fetching Camp Lead status:', error);
    res.json({ user: req.user }); // Fallback
  }
});
```

---

### **Step 2: Update User Type to Include Camp Lead Fields**

**File**: `client/src/types/index.ts`, line 1-66

**ADD** after line 35:
```typescript
  // Camp Lead role (when user is a Camp Lead for a specific camp)
  isCampLead?: boolean;
  campLeadCampId?: string;
  campLeadCampSlug?: string;
  campLeadCampName?: string;
```

---

### **Step 3: Update Navbar to Detect Camp Lead Status**

**File**: `client/src/components/layout/Navbar.tsx`, line 89-185

**BEFORE** (line 89-97):
```javascript
const getNavItems = () => {
  if (!isAuthenticated) return [];

  // Debug logging
  console.log('Navbar - User data:', user);
  console.log('Navbar - Account type:', user?.accountType);
  console.log('Navbar - Camp name:', user?.campName);
  console.log('Navbar - Is authenticated:', isAuthenticated);
```

**AFTER**:
```javascript
const getNavItems = () => {
  if (!isAuthenticated) return [];

  // Debug logging
  console.log('Navbar - User data:', user);
  console.log('Navbar - Account type:', user?.accountType);
  console.log('Navbar - Is Camp Lead:', user?.isCampLead);
  console.log('Navbar - Camp Lead Camp:', user?.campLeadCampName);
  console.log('Navbar - Is authenticated:', isAuthenticated);

  // ============================================================================
  // CAMP LEAD NAVIGATION
  // Camp Leads are personal accounts with delegated admin permissions for a camp
  // They should see camp management navigation (Roster, Applications, etc.)
  // but NOT member discovery navigation (My Applications, Discover Camps)
  // ============================================================================
  if (user?.isCampLead && user?.campLeadCampId && user?.campLeadCampSlug) {
    const campIdentifier = user.campLeadCampId;
    const campSlug = user.campLeadCampSlug;
    
    console.log('✅ [Navbar] User is Camp Lead, showing camp management navigation');
    
    return [
      { label: 'My Profile', path: '/user/profile', icon: <AccountCircle size={18} /> },
      { label: 'Camp Profile', path: `/camps/${campSlug}`, icon: <HomeIcon size={18} /> },
      { label: 'Roster', path: `/camp/${campIdentifier}/roster`, icon: <People size={18} /> },
      { label: 'Applications', path: `/camp/${campIdentifier}/applications`, icon: <Assignment size={18} /> },
      { label: 'Tasks', path: `/camp/${campIdentifier}/tasks`, icon: <Task size={18} /> },
      { label: 'Events', path: `/camp/${campIdentifier}/events`, icon: <Calendar size={18} /> },
      { label: 'Help', path: '/member/help', icon: <Help size={18} /> }
    ];
  }
```

**KEEP existing camp/admin navigation** (line 99-161) **BUT UPDATE** (line 99):
```javascript
// Camp/Admin accounts navigation (ordered as requested)
// Note: Camp Leads are handled separately above
if (user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) {
```

---

### **Step 4: Refresh User Data After Granting Camp Lead**

**File**: `client/src/pages/members/MemberRoster.tsx`

**FIND** the `handleCampLeadConfirm` function and **ADD** after successful grant:

```typescript
// After granting Camp Lead
await api.post(`/rosters/member/${member._id}/grant-camp-lead`);

// Refresh user data if current user was granted role
if (authUser?._id === member._id) {
  await refreshUser(); // This will fetch updated Camp Lead status
}
```

---

## 📊 USER FLOW (After Fix)

### **Scenario: Grant Camp Lead to "test 8"**

1. **Camp Owner grants role**:
   - Clicks "Grant Camp Lead" on "test 8"
   - Backend: `isCampLead: true` saved to roster ✅
   
2. **"test 8" refreshes page** (or logs out/in):
   - Frontend calls `/api/auth/me`
   - Backend queries rosters for Camp Lead status
   - Returns:
     ```json
     {
       "user": {
         "_id": "697e4ba0396f69ce26591eb2",
         "accountType": "personal",
         "role": "member",
         "isCampLead": true,
         "campLeadCampId": "68e43f61a8f6ec1271586306",
         "campLeadCampSlug": "mudskippers",
         "campLeadCampName": "Mudskippers Camp"
       }
     }
     ```
   
3. **Navbar updates**:
   - Detects `isCampLead: true`
   - Shows: ✅ Roster, ✅ Applications, ✅ Tasks, ✅ Events
   - Hides: ❌ My Applications, ❌ Discover Camps
   
4. **Permissions work**:
   - User clicks "Roster"
   - Backend checks `isCampLeadForCamp` → returns `true`
   - User can manage roster ✅

---

## 🧪 TESTING CHECKLIST

### **Test 1: Grant Camp Lead**
- [x] Grant role to "test 8"
- [ ] Check database: `isCampLead: true`
- [ ] "test 8" logs out and back in
- [ ] Navigation shows camp management links
- [ ] Navigation hides member discovery links

### **Test 2: Access Permissions**
- [ ] "test 8" clicks "Roster" → works
- [ ] "test 8" clicks "Applications" → works
- [ ] "test 8" clicks "Tasks" → works
- [ ] "test 8" clicks "Events" → works

### **Test 3: Revoke Camp Lead**
- [ ] Revoke role from "test 8"
- [ ] "test 8" logs out and back in
- [ ] Navigation shows member links again
- [ ] Navigation hides camp management links
- [ ] Cannot access roster (403)

### **Test 4: Multiple Users**
- [ ] Cannot be Camp Lead in multiple camps (only one)
- [ ] If granted in Camp B while already lead in Camp A, revoke from A first

---

## 🎯 IMPLEMENTATION ORDER

1. ✅ Fix backend save (already done in previous commit)
2. 🔄 Enhance `/api/auth/me` endpoint
3. 🔄 Update User TypeScript type
4. 🔄 Update Navbar logic
5. 🔄 Add refresh after grant (optional but better UX)
6. 🧪 Test all scenarios

---

**Status**: Ready to implement backend + frontend changes
**Complexity**: MEDIUM (requires backend query + frontend logic)
**Impact**: HIGH - Makes Camp Lead feature fully functional
