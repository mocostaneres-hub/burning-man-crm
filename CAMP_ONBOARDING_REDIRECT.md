# Camp Account Onboarding - Automatic Redirect to Profile Edit

## Overview
This document describes the implementation of automatic redirects for newly created camp admin accounts to ensure they land directly on their Camp Profile Edit page upon registration or first login.

## Implementation Date
October 19, 2025

## Changes Made

### 1. Backend Changes (`server/routes/auth.js`)

#### Registration Endpoint (`POST /api/auth/register`)
- **Line 117**: Added `isNewAccount: true` flag to the registration response
- This flag indicates when an account is newly created

#### Login Endpoint (`POST /api/auth/login`)
- **Lines 169-170**: Added logic to detect first-time camp admin logins
- **Line 176**: Added `isFirstLogin` flag to login response
- Detection logic: `!user.lastLogin && user.accountType === 'camp'`

### 2. Frontend Changes

#### API Service (`client/src/services/api.ts`)
- **Lines 61, 77-79**: Updated TypeScript types to include:
  - `isFirstLogin?: boolean` for login responses
  - `isNewAccount?: boolean` for registration responses

#### Auth Context (`client/src/contexts/AuthContext.tsx`)
- **Lines 47-61**: Modified `login` function to return `{ isFirstLogin?: boolean }`
- Now propagates the `isFirstLogin` flag from the API response

#### Type Definitions (`client/src/types/index.ts`)
- **Line 300**: Updated `AuthContextType.login` signature to return `Promise<{ isFirstLogin?: boolean }>`

#### CampEdit Page (`client/src/pages/camps/CampEdit.tsx`)
- **Lines 1-15**: Converted from placeholder to redirect component
- Now redirects to `/camp/profile` which has full editing functionality
- Added explanatory comments about redirect purpose

#### CampProfile Auto-Edit (`client/src/pages/camps/CampProfile.tsx`)
- **Lines 175-185**: Added useEffect hook to detect newly created camps
- Automatically enables edit mode when camp has default/minimal data
- Detection: Checks if description contains default registration text

#### Registration Flow (`client/src/pages/auth/Register.tsx`)
- **Lines 109-118**: Updated redirect logic after registration:
  - **Camp accounts** → `/camp/edit`
  - **Personal accounts** → `/member/profile`
- **Lines 126-138**: Updated OAuth success handler to check account type and redirect accordingly

#### Login Flow (`client/src/pages/auth/Login.tsx`)
- **Lines 40-61**: Updated login submit handler:
  - Checks `isFirstLogin` flag from API response
  - Redirects first-time camp admins to `/camp/edit`
  - Otherwise follows normal redirect logic
- **Lines 63-75**: Updated OAuth success handler to check for new camp accounts

## User Flow

### Scenario 1: New Camp Account Registration (Standard)
1. User fills out registration form, selecting "Camp Account"
2. Backend creates user and camp records with default description
3. Frontend receives response with `isNewAccount: true`
4. User is **automatically redirected to `/camp/edit`** → `/camp/profile`
5. CampProfile detects default description and **automatically enables edit mode**
6. User sees the profile form ready to edit, can immediately start filling out their camp profile

### Scenario 2: First Login After Registration (Standard)
1. Returning camp admin logs in for the first time
2. Backend checks `lastLogin` field (null = first time)
3. Backend sets `isFirstLogin: true` in response
4. User is **automatically redirected to `/camp/edit`** → `/camp/profile`
5. If camp still has default data, edit mode is automatically enabled
6. Subsequent logins go to dashboard (once profile is filled out)

### Scenario 3: OAuth Registration (Google/Apple)
1. User registers via OAuth provider
2. `handleOAuthSuccess` receives user data
3. Checks `user.accountType === 'camp'`
4. Redirects to `/camp/edit` for camp accounts
5. Redirects to `/member/profile` for personal accounts

### Scenario 4: OAuth First Login
1. User logs in via OAuth
2. `handleOAuthSuccess` checks `user.accountType` and `user.lastLogin`
3. If camp account with no lastLogin → redirect to `/camp/edit`
4. Otherwise → normal redirect flow

## Technical Details

### Detection Logic
The backend determines first-time login by checking:
```javascript
const isFirstLogin = !user.lastLogin && user.accountType === 'camp';
```

This works because:
- `lastLogin` is `null` when user registers
- `lastLogin` is set on first actual login (line 159 in auth.js)
- Only camp accounts trigger the special redirect

### Redirect Paths
- **Camp Profile (Edit Mode)**: `/camp/edit` → redirects to `/camp/profile`
  - CampProfile automatically enables edit mode for newly created camps
- **Member Profile**: `/member/profile`
- **Default Dashboard**: `/dashboard`

### Auto-Edit Mode for New Camps
The `CampProfile` component includes logic to automatically enable edit mode when:
- The camp has just been created (detected via default description text)
- This provides a seamless onboarding experience without requiring users to find and click the "Edit Profile" button

## Benefits

1. **Streamlined Onboarding**: Camp admins don't need to navigate to find the profile edit page
2. **Improved UX**: Clear next step for new camp administrators
3. **Profile Completion**: Encourages immediate profile setup
4. **Reduced Confusion**: No empty dashboard for new camp admins

## Testing Recommendations

### Test Case 1: New Camp Registration
1. Navigate to `/register`
2. Select "Camp Account"
3. Fill in camp name (e.g., "Test Camp") and credentials
4. Submit form
5. **Expected**: Redirect to `/camp/edit` → `/camp/profile`
6. **Expected**: Profile form automatically in edit mode (input fields editable)
7. **Expected**: Can see default camp name and description ready to edit

### Test Case 2: First Login
1. Register a camp account but don't fill out the profile
2. Log out immediately
3. Log back in with same credentials
4. **Expected**: Redirect to `/camp/edit` → `/camp/profile`
5. **Expected**: Edit mode automatically enabled (if profile still has default data)
6. Fill out and save the profile
7. Log out and log in again
8. **Expected**: Normal redirect to `/dashboard` (profile complete)

### Test Case 3: OAuth Registration
1. Click "Sign up with Google/Apple"
2. Complete OAuth flow, select camp account
3. **Expected**: Redirect to `/camp/edit`

### Test Case 4: Personal Account (Verification)
1. Register a personal account
2. **Expected**: Redirect to `/member/profile` (not camp edit)

## Notes

- Personal accounts are unaffected by this change
- Existing camp accounts with `lastLogin` set will follow normal login flow
- The `isFirstLogin` flag is only used for routing, not stored
- All changes are backward compatible

## Related Files

### Backend
- `server/routes/auth.js` - Login/registration endpoints with redirect flags
- `server/models/User.js` - Contains lastLogin field

### Frontend
- `client/src/pages/auth/Login.tsx` - Login flow with first-time detection
- `client/src/pages/auth/Register.tsx` - Registration flow with account type routing
- `client/src/pages/camps/CampEdit.tsx` - Redirect wrapper to CampProfile
- `client/src/pages/camps/CampProfile.tsx` - Main profile page with auto-edit mode
- `client/src/contexts/AuthContext.tsx` - Authentication context with redirect data
- `client/src/services/api.ts` - API service with response types
- `client/src/types/index.ts` - TypeScript interfaces

## Future Enhancements

Consider implementing:
1. Profile completion progress indicator
2. Onboarding checklist for new camp admins
3. Welcome modal with quick tips
4. Required field validation before allowing navigation away from edit page

