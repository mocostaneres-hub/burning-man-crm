# Camp Lead Feature - QA Test Plan

**Status**: Ready for Testing  
**Last Updated**: February 2, 2026  
**Priority**: CRITICAL - Must Pass Before Production Approval

---

## Test Environment

**URLs**:
- Frontend: https://www.g8road.com
- Backend: https://api.g8road.com

**Test Accounts**:
- Camp Admin: (Mudskippers camp owner)
- Camp Lead: test 8 (lead8@g8road.com)
- Standard Member: (any other roster member)

**Test Camp**: Mudskippers (`campId: 68e43f61a8f6ec1271586306`)

---

## PRE-TEST SETUP

### 1. Grant Camp Lead Role
- [ ] Log in as Mudskippers camp admin
- [ ] Go to Roster page
- [ ] Click "Edit" on member "test 8"
- [ ] Check "Camp Lead" checkbox
- [ ] Click "Save Changes"
- [ ] Verify success message appears
- [ ] Log out

### 2. Camp Lead First Login
- [ ] Log in as "test 8" (lead8@g8road.com)
- [ ] **CRITICAL**: Log out and log back in to refresh session
- [ ] Verify navigation shows camp management links

---

## TEST SUITE 1: NAVIGATION

### Test 1.1: Camp Lead Navigation Links
**Expected Navigation**:
- ✅ My Profile
- ✅ Camp Profile
- ✅ Roster
- ✅ Applications
- ✅ Tasks
- ✅ Events
- ✅ Help

**Hidden Links**:
- ❌ My Applications (should NOT appear)
- ❌ Discover Camps (should NOT appear)

**Steps**:
1. Log in as "test 8" Camp Lead
2. Check top navigation bar
3. **PASS**: All expected links present, hidden links absent
4. **FAIL**: Missing links or wrong links shown

---

## TEST SUITE 2: ROSTER PAGE

### Test 2.1: Load Roster Data
**URL**: `/camp/68e43f61a8f6ec1271586306/roster`

**Expected**:
- ✅ Page loads without errors
- ✅ Roster members displayed (NOT empty)
- ✅ Member count shown
- ✅ All member cards visible

**Steps**:
1. Click "Roster" link
2. Wait for page to load
3. **PASS**: Roster shows all members (34 members for Mudskippers)
4. **FAIL**: Empty roster, loading spinner stuck, or error message

### Test 2.2: View Member Details
**Expected**:
- ✅ Can click "View" button on any member
- ✅ Member details modal opens
- ✅ Shows member's profile info

**Steps**:
1. Click "View" on any roster member
2. **PASS**: Modal opens with member details
3. **FAIL**: No modal, error, or missing data

### Test 2.3: Edit Member
**Expected**:
- ✅ Can click "Edit" button
- ✅ Can modify overrides (playa name, skills, etc.)
- ✅ Can save changes successfully

**Steps**:
1. Click "Edit" on any member
2. Change a field (e.g., playa name)
3. Click "Save"
4. **PASS**: Success message, changes persist after refresh
5. **FAIL**: Error saving, changes lost, or page breaks

### Test 2.4: Grant Camp Lead to Another Member
**Expected**:
- ✅ Can check "Camp Lead" checkbox
- ✅ Can save successfully
- ✅ Confirmation modal appears

**Steps**:
1. Click "Edit" on a different member
2. Check "Camp Lead" checkbox
3. Confirm in modal
4. **PASS**: Role granted, success message shown
5. **FAIL**: Error, permission denied, or no change

### Test 2.5: Revoke Camp Lead from Self
**Expected**:
- ❌ Should NOT be able to revoke own Camp Lead role
- ✅ Checkbox should be visible but confirm if policy allows self-revoke

**Steps**:
1. Find own member record in roster
2. Try to uncheck "Camp Lead"
3. **PASS**: Policy confirmed (either allowed or blocked as intended)
4. **FAIL**: Unexpected behavior

---

## TEST SUITE 3: APPLICATIONS PAGE

### Test 3.1: Load Applications
**URL**: `/camp/68e43f61a8f6ec1271586306/applications`

**Expected**:
- ✅ Page loads without errors
- ✅ Applications list displayed (NOT empty)
- ✅ Application count shown
- ✅ All statuses visible (pending, approved, rejected, etc.)

**Steps**:
1. Click "Applications" link
2. Wait for page to load
3. **PASS**: Shows all pending/reviewed applications
4. **FAIL**: Empty list, error, or stuck loading

### Test 3.2: View Application Details
**Expected**:
- ✅ Can click "View" on any application
- ✅ Modal/details page opens
- ✅ Shows applicant's full info

**Steps**:
1. Click "View" on any application
2. **PASS**: Details displayed correctly
3. **FAIL**: No details, error, or broken modal

### Test 3.3: Approve Application
**Expected**:
- ✅ Can click "Approve" button
- ✅ Application moves to approved status
- ✅ Member added to roster

**Steps**:
1. Find a "pending" application
2. Click "Approve"
3. Confirm if modal appears
4. **PASS**: Application approved, member in roster
5. **FAIL**: Error, permission denied, or no change

### Test 3.4: Reject Application
**Expected**:
- ✅ Can click "Reject" button
- ✅ Application moves to rejected status
- ✅ Member NOT added to roster

**Steps**:
1. Find a "pending" application
2. Click "Reject"
3. **PASS**: Application rejected, not in roster
4. **FAIL**: Error or unexpected state

### Test 3.5: Re-Approve Rejected Application
**Expected**:
- ✅ Can approve a previously rejected application
- ✅ Member added to roster (or reactivated if already exists)
- ✅ No duplicate key errors

**Steps**:
1. Find a "rejected" application
2. Click "Approve"
3. **PASS**: Application re-approved, member in roster
4. **FAIL**: Error about duplicate member or database error

---

## TEST SUITE 4: TASKS PAGE

### Test 4.1: Load Tasks
**URL**: `/camp/68e43f61a8f6ec1271586306/tasks`

**Expected**:
- ✅ Page loads without errors
- ✅ Tasks list displayed
- ✅ Can see open and closed tasks

**Steps**:
1. Click "Tasks" link
2. Wait for page to load
3. **PASS**: Tasks shown (even if empty is OK)
4. **FAIL**: Error, stuck loading, or access denied

### Test 4.2: Create New Task
**Expected**:
- ✅ Can click "Create Task" button
- ✅ Can fill in task details (title, description, priority, due date)
- ✅ Can save task successfully

**Steps**:
1. Click "Create Task" or "+" button
2. Fill in task form
3. Click "Save"
4. **PASS**: Task created and appears in list
5. **FAIL**: Error, permission denied, or task not saved

### Test 4.3: Edit Existing Task
**Expected**:
- ✅ Can click on any task to view/edit
- ✅ Can modify task fields
- ✅ Can save changes

**Steps**:
1. Click on any existing task
2. Edit title or description
3. Click "Save"
4. **PASS**: Changes saved successfully
5. **FAIL**: Error or changes lost

### Test 4.4: Assign Task to Member
**Expected**:
- ✅ Can assign task to roster members
- ✅ Member receives notification (if implemented)

**Steps**:
1. Edit a task
2. Assign to a roster member
3. Save
4. **PASS**: Task assigned successfully
5. **FAIL**: Error or assignment fails

### Test 4.5: Close Task
**Expected**:
- ✅ Can mark task as completed/closed
- ✅ Task moves to "Closed" tab

**Steps**:
1. Open a task
2. Mark as complete/closed
3. **PASS**: Task status updated, moves to closed tab
4. **FAIL**: Error or task still open

---

## TEST SUITE 5: EVENTS PAGE

### Test 5.1: Load Events
**URL**: `/camp/68e43f61a8f6ec1271586306/events`

**Expected**:
- ✅ Page loads without errors
- ✅ Events/shifts displayed
- ✅ Calendar or list view works

**Steps**:
1. Click "Events" link
2. Wait for page to load
3. **PASS**: Events shown (even if empty is OK)
4. **FAIL**: Error, stuck loading, or access denied

### Test 5.2: Create New Event
**Expected**:
- ✅ Can create new event
- ✅ Can set event details (name, date, time, description)
- ✅ Event saves successfully

**Steps**:
1. Click "Create Event" button
2. Fill in event form
3. Save
4. **PASS**: Event created and displayed
5. **FAIL**: Error or event not saved

### Test 5.3: Create Shifts for Event
**Expected**:
- ✅ Can add shifts to an event
- ✅ Can set shift times
- ✅ Can assign members to shifts

**Steps**:
1. Open an event
2. Add shift
3. Assign roster member
4. **PASS**: Shift created and assigned
5. **FAIL**: Error or shift not saved

---

## TEST SUITE 6: CAMP PROFILE

### Test 6.1: View Camp Profile
**Expected**:
- ✅ Can click "Camp Profile" link
- ✅ Can view public camp profile
- ✅ Sees all camp information

**Steps**:
1. Click "Camp Profile" link
2. **PASS**: Profile displayed correctly
3. **FAIL**: Error or access denied

### Test 6.2: Edit Camp Profile (Permission Check)
**Expected**:
- ❌ Camp Lead should NOT be able to edit camp profile settings
- ✅ Can view but not edit

**Steps**:
1. Look for "Edit Profile" button on camp profile
2. **PASS**: Button hidden OR editing restricted
3. **FAIL**: Can edit camp settings (this is a bug - only owner should edit)

---

## TEST SUITE 7: PERMISSIONS & ACCESS CONTROL

### Test 7.1: Access Denied on Member Pages
**Expected**:
- ❌ Cannot access `/applications` (My Applications)
- ❌ Cannot access `/camps` (Discover Camps)
- ✅ Redirected or shown error

**Steps**:
1. Manually navigate to `/applications`
2. Manually navigate to `/camps`
3. **PASS**: Redirected to dashboard or shown "Access Denied"
4. **FAIL**: Can access pages (not expected for Camp Lead)

### Test 7.2: Cannot Access Other Camps
**Expected**:
- ❌ Cannot access roster/applications/tasks for different camp
- ✅ Gets "Access Denied" or 403 error

**Steps**:
1. Try to navigate to `/camp/DIFFERENT_CAMP_ID/roster`
2. **PASS**: Blocked with error message
3. **FAIL**: Can access other camp's data

---

## TEST SUITE 8: REVOCATION FALLBACK

### Test 8.1: Revoke Camp Lead Role
**Expected**:
- ✅ Camp admin can revoke "test 8" Camp Lead role
- ✅ Success message shown

**Steps**:
1. Log in as camp admin
2. Go to Roster
3. Edit "test 8"
4. Uncheck "Camp Lead"
5. Save
6. **PASS**: Role revoked successfully
7. **FAIL**: Error or role not revoked

### Test 8.2: Camp Lead Fallback After Revocation
**Expected**:
- ✅ After logout/login, navigation switches to member view
- ✅ Shows: My Profile, My Applications, My Tasks, Discover Camps
- ✅ Hides: Roster, Applications (camp), Tasks (camp), Events
- ❌ Cannot access camp management pages (403/Access Denied)

**Steps**:
1. As "test 8", log out
2. Log back in
3. Check navigation
4. Try to access `/camp/:id/roster`
5. **PASS**: Member navigation shown, camp pages blocked
6. **FAIL**: Still has Camp Lead access or broken state

---

## TEST SUITE 9: EDGE CASES

### Test 9.1: Multiple Browser Tabs
**Expected**:
- ✅ Camp Lead access works across multiple tabs
- ✅ No session conflicts

**Steps**:
1. Open 2+ browser tabs as Camp Lead
2. Navigate to different pages in each tab
3. **PASS**: All tabs work correctly
4. **FAIL**: Errors, logout, or broken state

### Test 9.2: Session Timeout
**Expected**:
- ✅ After session expires, redirected to login
- ✅ After login, Camp Lead status restored

**Steps**:
1. Leave browser idle for extended period
2. Try to navigate
3. **PASS**: Prompted to log in, then access restored
4. **FAIL**: Broken state or lost Camp Lead status

### Test 9.3: Concurrent Actions (Admin and Camp Lead)
**Expected**:
- ✅ Camp admin and Camp Lead can work simultaneously
- ✅ No data conflicts or race conditions

**Steps**:
1. Camp admin edits roster in one browser
2. Camp Lead edits roster in another browser
3. **PASS**: Both changes save correctly
4. **FAIL**: Data loss or conflicts

---

## CRITICAL SUCCESS CRITERIA

### Must Pass (Blockers):
1. ✅ Navigation shows correct links for Camp Lead
2. ✅ Roster page loads with data
3. ✅ Applications page loads with data
4. ✅ Can edit roster members
5. ✅ Can approve/reject applications
6. ✅ Tasks page accessible
7. ✅ Events page accessible
8. ✅ Revocation fallback works (returns to member view)

### Should Pass (Important):
1. ✅ Can create tasks
2. ✅ Can create events
3. ✅ Can grant Camp Lead to others
4. ✅ Cannot edit camp profile (owner-only)
5. ✅ Cannot access other camps

### Nice to Have (Non-Blocking):
1. ✅ No console errors
2. ✅ Fast page loads
3. ✅ Smooth transitions

---

## REPORTING RESULTS

### Format:
```
TEST: [Test Name]
STATUS: PASS / FAIL
DETAILS: [What happened]
SCREENSHOT: [If applicable]
```

### Example:
```
TEST: 2.1 Load Roster Data
STATUS: PASS
DETAILS: Roster loaded with 34 members in 1.2 seconds
```

```
TEST: 3.3 Approve Application
STATUS: FAIL
DETAILS: Got 403 Forbidden error when clicking Approve
SCREENSHOT: error-approve-403.png
```

---

## APPROVAL CHECKLIST

**QA Engineer**: _______________  
**Date**: _______________

- [ ] All CRITICAL tests passed
- [ ] All IMPORTANT tests passed (or documented as known issues)
- [ ] No blockers found
- [ ] Edge cases tested
- [ ] Revocation fallback verified

**APPROVED FOR PRODUCTION**: YES / NO

---

## NEXT STEPS AFTER QA

If PASS:
1. Update CAMP_LEAD_COMPLETE.md with QA results
2. Mark feature as production-ready
3. Notify team

If FAIL:
1. Document all failures
2. Create bug fix tasks
3. Re-test after fixes
4. Repeat QA cycle
