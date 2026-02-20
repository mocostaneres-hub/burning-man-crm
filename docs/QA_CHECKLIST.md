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
