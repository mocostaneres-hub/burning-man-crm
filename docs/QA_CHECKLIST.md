# QA Checklist – Recent Fixes

Use this list to verify the latest changes before or after deploy. All items should pass.

---

## Build & automated

- [ ] **Client build:** `cd client && npm run build` — completes with exit 0
- [ ] **Client tests:** `cd client && CI=true npm test -- --watchAll=false` — all tests pass
- [ ] **Server routes:** Server starts without errors; no require/syntax errors in `server/routes/`

---

## Account type selection (onboarding)

- [ ] **Two-step Camp Lead:** On `/onboarding/select-role`, clicking "Sign up as Camp Lead" shows the camp name field and Back / Continue (no API call yet)
- [ ] **Camp name required:** "Continue" is disabled until camp name is non-empty; submitting without name shows validation error
- [ ] **Back:** "Back" returns to the two cards and clears camp name
- [ ] **Continue:** Filling camp name and clicking "Continue" submits and redirects to camp edit; camp is created with that name and correct slug
- [ ] **Member flow:** "Sign up as Member" still works with one click, no camp name field

---

## Camp slug & profile

- [ ] **New camp slug:** Create camp with name "Mudskippers" (via onboarding camp name) → slug is `mudskippers`, "My Camp" goes to `/camps/mudskippers` and loads
- [ ] **Camp name read-only:** As camp owner (not system admin), on camp edit the Camp Name field is read-only with note "can only be changed by a system admin"
- [ ] **System admin:** Logged in as system admin, Camp Name is editable on camp edit
- [ ] **Private camp:** Set camp to Private; as Camp Lead (owner) open "My Camp" → page loads (no 500). As non-owner/non-admin → 403 or appropriate message, not 500

---

## System Admin member list

- [ ] **Admin users list:** As system admin at `/admin`, Users tab shows many members (not only first 20); search works
- [ ] **Multi-role user:** A user who is both Roster Member and Camp Lead (e.g. Casie Clymer) appears in the list when applicable
- [ ] **Personal only:** Users tab still shows only personal accounts (no camp accounts in that list)

---

## Promote to System Admin

- [ ] **Only system admins see Promote:** Logged in as Camp Lead or Roster Member, no "Promote" button on users in `/admin`
- [ ] **System admin sees Promote:** Logged in as system admin, "Promote" button visible for users who are not already system admins
- [ ] **Already admin:** Users who are already system admin (badge "System Admin") do not show Promote button
- [ ] **Confirmation modal:** Clicking Promote opens modal: "Are you sure you want to grant full system access?" with target name/email
- [ ] **Promotion succeeds:** Confirm promotion → user gets "System Admin" badge; they can access `/admin` and full system features
- [ ] **403 for non–system admin:** Call `POST /api/admin/users/:id/promote-to-system-admin` as Camp Lead or without auth → 403
- [ ] **Audit:** After promotion, user history or audit log shows PROMOTE_TO_SYSTEM_ADMIN action
- [ ] **Roles preserved:** Promoted user keeps Camp Lead / Roster Member roles and camp associations

---

## Password Recovery

### Functional
- [ ] **Forgot link:** Login page has "Forgot your password?" link to `/forgot-password`
- [ ] **Existing email:** Submitting an existing (password) email shows success message; reset email is received
- [ ] **Non-existing email:** Submitting a non-existing email shows error: "No account found with that email address."
- [ ] **Reset link:** Email contains link to `https://www.g8road.com/reset-password?token=...` (or CLIENT_URL)
- [ ] **Expired token:** Using reset link after expiry shows "Invalid or expired reset link"
- [ ] **Used token:** Using same reset link twice fails the second time
- [ ] **Valid token:** Valid link opens reset form; submitting new password succeeds
- [ ] **Password updated:** After reset, user can log in with new password; old password no longer works
- [ ] **Redirect:** After successful reset, user sees success message and is redirected to login

### Security
- [ ] **Token not in logs:** Reset tokens are not logged (check server logs)
- [ ] **Rate limit:** Multiple forgot-password requests from same IP are rate limited (e.g. 5 per 15 min)
- [ ] **Weak password:** Password &lt; 6 characters is rejected on reset
- [ ] **No stack traces:** 500 responses do not expose stack traces to client

### Edge cases
- [ ] **Email case:** Reset request with different case (e.g. User@Example.com) normalizes and finds user
- [ ] **Multiple requests:** Requesting reset again invalidates previous token (new token works, old does not)
- [ ] **OAuth-only account:** Email that has only OAuth (no password) returns "No account found"

---

## FAQ & Help

- [ ] **Help page:** `/help` (or `/camp/help` / `/member/help`) loads FAQs; camp context sees camp + both; member context sees member + both
- [ ] **Home FAQ:** Home page FAQ section loads and expands/collapses without errors

---

## Regression

- [ ] **Existing camps:** Existing camps with correct slugs still resolve at `/camps/:slug`
- [ ] **Admin panel:** Admin dashboard loads; camps and users tabs work
- [ ] **Roster members:** Camp roster and applications still work for Camp Lead and members

---

*Last updated for: FAQ audit, admin member list visibility, camp onboarding slug/visibility, mandatory camp name + two-step flow, camp name read-only.*
