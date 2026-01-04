# Camp Admin Onboarding Flow

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW CAMP ACCOUNT CREATION                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  User visits     │
│  /register page  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│ Selects "Camp Account"   │
│ Enters camp name, email  │
│ Creates password         │
└────────┬─────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  BACKEND: POST /api/auth/register       │
│  - Creates User record                  │
│  - Creates Camp record                  │
│  - Sets default description             │
│  - Returns: isNewAccount = true         │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  FRONTEND: Register.tsx                 │
│  - Detects accountType === 'camp'       │
│  - Redirects to /camp/edit              │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  FRONTEND: CampEdit.tsx                 │
│  - Immediately redirects to /camp/profile│
└────────┬────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  FRONTEND: CampProfile.tsx               │
│  - Loads camp data                       │
│  - Detects default description           │
│  - Auto-enables edit mode ✨             │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  USER SEES: Editable Profile Form        │
│  ✓ Camp name pre-filled                  │
│  ✓ All fields ready to edit              │
│  ✓ Save/Cancel buttons visible           │
│  ✓ Clear call to action                  │
└──────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    FIRST LOGIN AFTER REGISTRATION                │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  User logs in    │
│  /login page     │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  BACKEND: POST /api/auth/login          │
│  - Checks user.lastLogin === null       │
│  - Checks accountType === 'camp'        │
│  - Returns: isFirstLogin = true         │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  FRONTEND: Login.tsx                    │
│  - Detects isFirstLogin === true        │
│  - Redirects to /camp/edit              │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  [Same flow as registration above]      │
│  → CampEdit → CampProfile (edit mode)   │
└─────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    SUBSEQUENT LOGINS (NORMAL FLOW)               │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  User logs in    │
│  /login page     │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  BACKEND: POST /api/auth/login          │
│  - user.lastLogin exists                │
│  - Returns: isFirstLogin = false        │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  FRONTEND: Login.tsx                    │
│  - isFirstLogin === false               │
│  - Follows normal redirect              │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Redirects to /dashboard                │
│  (Normal camp admin dashboard)          │
└─────────────────────────────────────────┘
```

## Key Decision Points

### Backend Decision: Is this first login?
```javascript
const isFirstLogin = !user.lastLogin && user.accountType === 'camp';
```

### Frontend Decision: Should we redirect to edit?
```javascript
if (result.isFirstLogin) {
  navigate('/camp/edit');
} else {
  navigate('/dashboard');
}
```

### Auto-Edit Decision: Should we enable edit mode?
```javascript
const isNewCamp = !campData.description || 
                  campData.description.includes("We're excited to share our camp experience");
if (isNewCamp) {
  setIsEditing(true);
}
```

## OAuth Flow (Google/Apple)

```
OAuth Sign-Up
     ↓
handleOAuthSuccess(user)
     ↓
Check: user.accountType === 'camp'?
     ↓
  Yes → /camp/edit → /camp/profile (edit mode)
     ↓
  No → /member/profile
```

## Flow Characteristics

### ✅ Seamless Onboarding
- Zero clicks to reach edit mode
- No navigation required
- Clear visual feedback

### 🔒 Safe Defaults
- Only affects new accounts
- Existing users unaffected
- Backward compatible

### 🎯 Smart Detection
- Uses server-side data (lastLogin)
- Validates with client-side checks (default description)
- Works across all authentication methods

### 🔄 Progressive Enhancement
- First time: Auto-edit mode
- Profile incomplete: Edit mode suggested
- Profile complete: Normal dashboard

## Edge Cases Handled

1. **User closes browser during registration**
   - First login triggers redirect to edit
   - Profile auto-enters edit mode

2. **User saves empty profile**
   - Still detects default description
   - Edit mode remains enabled

3. **User completes minimal profile**
   - Description changed = profile considered "complete"
   - Next login goes to dashboard

4. **OAuth without completing profile**
   - Same detection logic applies
   - Redirect to edit mode on next login

---

**Result**: New camp admins land directly in profile edit mode within 2 seconds of account creation 🚀

