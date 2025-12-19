# OAuth Account Linking Fix

## Problem

Users who previously signed up with email/password using a Gmail address could not log in with Google OAuth. Attempting OAuth login caused:

```
E11000 duplicate key error on users.urlSlug
```

This error indicated that OAuth login was attempting to **create a duplicate user** instead of **linking to the existing account**.

## Root Cause

1. **Incorrect Lookup Order**: The OAuth flow was only looking up users by email, not by `googleId` first
2. **No Provider Tracking**: The system had no way to track which authentication methods were enabled for each user
3. **Slug Regeneration**: When linking OAuth accounts, updating user fields triggered the pre-save hook that regenerated URL slugs
4. **No Uniqueness on OAuth IDs**: `googleId` and `appleId` fields had no unique constraints
5. **Slug Collision**: The slug generation logic didn't handle duplicates, causing E11000 errors

## Solution

### 1. Added authProviders Field

**File**: `server/models/User.js`

Added a new field to track which authentication methods are enabled:

```javascript
authProviders: [{
  type: String,
  enum: ['password', 'google', 'apple']
}]
```

This allows us to:
- Track all authentication methods for a user
- Support multiple login methods for the same account
- Understand how users authenticate

### 2. Added Unique Constraints on OAuth IDs

**File**: `server/models/User.js`

Added unique sparse indexes:

```javascript
googleId: {
  type: String,
  sparse: true,
  unique: true // Prevent duplicate Google accounts
},
appleId: {
  type: String,
  sparse: true,
  unique: true // Prevent duplicate Apple accounts
}
```

This prevents:
- Multiple users linking the same Google/Apple account
- Duplicate OAuth accounts being created

### 3. Fixed OAuth Lookup Order

**File**: `server/routes/oauth.js`

Changed the lookup logic to follow this order:

```javascript
// Step 1: Try to find user by OAuth provider ID (googleId/appleId)
let user = await db.findUser({ googleId: googleUser.googleId });

// Step 2: If not found, try to find by email (to link OAuth to existing account)
if (!user) {
  user = await db.findUser({ email: googleUser.email });
  
  if (user) {
    // Existing user found - LINK OAuth account
    isLinkingOAuth = true;
  }
}

// Step 3: Only create new user if neither exists
if (!user) {
  // Create new user with OAuth
}
```

This ensures:
- Returning OAuth users are found immediately
- Existing email/password users can link OAuth
- No duplicate accounts are ever created

### 4. Prevented Slug Regeneration During OAuth Linking

**File**: `server/routes/oauth.js`

When linking OAuth to an existing account, we now use targeted updates:

```javascript
const updateFields = {
  googleId: googleUser.googleId,
  lastLogin: new Date(),
  $addToSet: { authProviders: 'google' }
  // NOTE: We DON'T update firstName/lastName here
  // This prevents triggering the slug regeneration hook
};

// Only update profile photo if user doesn't have one
if (!user.profilePhoto && googleUser.picture) {
  updateFields.profilePhoto = googleUser.picture;
}

await db.updateUserById(user._id, updateFields);
```

This prevents:
- Slug regeneration when linking OAuth
- Overwriting existing user data
- Triggering unnecessary pre-save hooks

### 5. Added Defensive Slug Uniqueness

**File**: `server/models/User.js`

Updated the slug generation pre-save hook:

```javascript
// Generate base slug
let baseSlug = nameToUse
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

// Ensure uniqueness by appending counter if needed
let slug = baseSlug;
let counter = 1;

while (await User.findOne({ urlSlug: slug, _id: { $ne: this._id } })) {
  slug = `${baseSlug}-${counter}`;
  counter++;
}

this.urlSlug = slug;
```

This ensures:
- No E11000 duplicate key errors on urlSlug
- Users with the same name get unique slugs (e.g., `john-smith`, `john-smith-1`)
- Existing users' slugs are never changed

### 6. Initialized authProviders for New Users

**Files**: 
- `server/routes/auth.js` (password registration)
- `server/routes/oauth.js` (OAuth registration)

All new users now have `authProviders` set:

```javascript
// Password registration
userData.authProviders = ['password'];

// Google OAuth
user.authProviders = ['google'];

// Apple OAuth
user.authProviders = ['apple'];
```

### 7. Migration Script for Existing Users

**File**: `migrate-add-auth-providers.js`

Created a migration script to initialize `authProviders` for existing users:

```bash
node migrate-add-auth-providers.js
```

The script:
- Finds all users without `authProviders`
- Checks for `googleId` → adds 'google'
- Checks for `appleId` → adds 'apple'
- If no OAuth IDs → adds 'password' (default)

## Testing

### Test Case 1: Existing Email/Password User Links Google

**Setup**:
1. User signs up with email: `user@gmail.com`, password: `password123`
2. User's account has `urlSlug: "john-smith"`, `authProviders: ['password']`

**Test**:
1. User clicks "Sign in with Google"
2. Selects `user@gmail.com` in Google consent screen

**Expected Result**:
- ✅ User is logged in successfully
- ✅ No duplicate user created
- ✅ User's `googleId` is now set
- ✅ User's `authProviders` now includes both: `['password', 'google']`
- ✅ User's `urlSlug` remains `"john-smith"` (unchanged)
- ✅ User can now log in with either email/password OR Google

**Error Before Fix**:
```
E11000 duplicate key error: users.$urlSlug dup key: { urlSlug: "john-smith" }
```

### Test Case 2: New Google OAuth User

**Setup**:
- User has never signed up before
- User clicks "Sign in with Google"

**Test**:
1. Select Google account
2. Complete OAuth flow

**Expected Result**:
- ✅ New user created
- ✅ User's `googleId` is set
- ✅ User's `authProviders` is `['google']`
- ✅ User's `urlSlug` is generated (e.g., `"john-smith"` or `"john-smith-1"` if duplicate)
- ✅ User can log in with Google
- ✅ User can later add password authentication if desired

### Test Case 3: User with Duplicate Name

**Setup**:
1. User 1: `john@example.com`, name: "John Smith" → slug: `"john-smith"`
2. User 2: `john.smith@gmail.com`, name: "John Smith" → signs up with Google

**Expected Result**:
- ✅ User 2 is created successfully
- ✅ User 2's `urlSlug` is `"john-smith-1"` (auto-incremented)
- ✅ No E11000 error
- ✅ Both users can exist with same name

### Test Case 4: User Tries to Link Already-Linked Google Account

**Setup**:
1. User A: `usera@example.com` has `googleId: "google123"`
2. User B: `userb@example.com` tries to link the same Google account

**Expected Result**:
- ❌ Error: "This Google account is already linked to another user"
- ✅ No duplicate allowed (enforced by unique constraint)

## Implementation Checklist

- [x] Added `authProviders` field to User model
- [x] Added unique sparse indexes on `googleId` and `appleId`
- [x] Fixed OAuth lookup order (OAuth ID first, then email)
- [x] Prevented slug regeneration during OAuth linking
- [x] Added defensive slug uniqueness with counter
- [x] Updated password registration to set `authProviders`
- [x] Updated Google OAuth to set `authProviders`
- [x] Updated Apple OAuth to set `authProviders`
- [x] Created migration script for existing users
- [x] Added comprehensive logging for debugging
- [x] Created documentation

## Deployment Steps

### 1. Deploy Code Changes

```bash
git add -A
git commit -m "Fix OAuth account linking and prevent duplicate users"
git push origin main
```

### 2. Run Migration Script (Production)

**Option A: Railway CLI**
```bash
railway run node migrate-add-auth-providers.js
```

**Option B: Manual Execution**
1. SSH into production server
2. Run: `node migrate-add-auth-providers.js`

**Option C: One-time Deployment**
- Create a temporary deployment job that runs the migration
- Remove the job after migration completes

### 3. Verify Migration

Check a few user accounts in the database:

```javascript
// Should show authProviders array
db.users.findOne({ email: "user@example.com" });

// Expected output:
{
  _id: ObjectId("..."),
  email: "user@example.com",
  authProviders: ["password"], // or ["google"], or ["password", "google"]
  ...
}
```

### 4. Test OAuth Login

1. Find a test user who has email/password account
2. Try logging in with Google OAuth using the same email
3. Verify:
   - ✅ Login succeeds
   - ✅ No duplicate user created
   - ✅ `authProviders` includes both methods

## Key Principles

### 1. Email is the Primary Identity

- One email = one account
- OAuth is an authentication METHOD, not a separate identity
- Users should be able to add/remove auth methods

### 2. OAuth is Account-Type Agnostic

- OAuth works for ALL account types (personal, camp, admin)
- Account type affects permissions, not authentication
- Mobile apps use OAuth - must work for everyone

### 3. Never Create Duplicate Users

- Always check OAuth ID first, then email
- Use unique constraints to enforce this at DB level
- Fail fast if duplicate OAuth linking is attempted

### 4. Preserve User Data During Linking

- Don't overwrite existing profile data
- Don't regenerate slugs
- Only add new information (OAuth ID, profile photo if empty)

### 5. Support Multiple Auth Methods

- Users can have password + Google + Apple
- Track all methods in `authProviders` array
- Let users choose their preferred login method

## Monitoring

### Logs to Watch For

**Successful OAuth Linking**:
```
🔗 [OAuth] Linking Google account to existing user: user@example.com (accountType: personal)
✅ [OAuth] Successfully linked Google account. Updated auth providers: password,google
```

**Successful OAuth Login**:
```
✅ [OAuth] Returning Google user found: user@example.com (accountType: personal)
```

**New OAuth User Creation**:
```
✨ [OAuth] Creating new user: newuser@gmail.com
✅ [OAuth] Created new user with ID: 507f1f77bcf86cd799439011, slug: john-smith
```

### Common Errors

**Duplicate Google Account**:
```
E11000 duplicate key error: users.$googleId dup key: { googleId: "google123" }
```
- Cause: Another user already linked this Google account
- Solution: Check which user has this `googleId`, help user access correct account

**Slug Generation Error** (should not happen now):
```
E11000 duplicate key error: users.$urlSlug dup key: { urlSlug: "john-smith" }
```
- Cause: Slug uniqueness logic failed (rare)
- Solution: Investigate pre-save hook, ensure counter logic works

## FAQ

### Q: What happens if a user signs up with Google, then tries to add a password?

A: They can add a password through "Profile Settings" → "Change Password". The `authProviders` will be updated to `['google', 'password']`.

### Q: Can a user have the same email for multiple accounts?

A: No. Email is unique and serves as the primary identity. One email = one account.

### Q: What if a user has a camp account and tries to log in with Google?

A: It works! OAuth is account-type agnostic. They'll be logged into their camp account.

### Q: Will existing users lose data during migration?

A: No. The migration only ADDS the `authProviders` field. No data is removed or modified.

### Q: What happens to urlSlug for existing users?

A: Nothing. Existing users' slugs are preserved. Only new users or users who explicitly change their name will get new slugs.

## Files Modified

1. `server/models/User.js` - Added authProviders field, unique indexes, improved slug generation
2. `server/routes/oauth.js` - Fixed lookup order, prevented slug regeneration, added linking logic
3. `server/routes/auth.js` - Added authProviders initialization for password registration
4. `migrate-add-auth-providers.js` - Migration script for existing users
5. `OAUTH_ACCOUNT_LINKING_FIX.md` - This documentation

## Related Documentation

- `GOOGLE_OAUTH_SETUP.md` - How to set up Google OAuth
- `GOOGLE_OAUTH_PRODUCTION_CONFIG.md` - Production environment configuration
- `GOOGLE_OAUTH_PRODUCTION_FIX.md` - Previous OAuth authentication fix

---

**Last Updated**: 2025-12-19  
**Status**: ✅ Implemented, ready for deployment and migration

