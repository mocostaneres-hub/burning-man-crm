# Camp Onboarding Slug and Visibility Fix

**Issue:** New camp onboarding used the user's personal name ("Mo Costa") to generate the camp slug instead of the camp name, and Camp Lead viewing their own private camp could see a server error.

**Status:** Fixed.

---

## 1. Root Cause

### Slug
- **Where:** `server/routes/onboarding.js` (camp creation when user selects "Lead a Camp").
- **What:** Camp name was set with:
  `const campName = user.campName || \`${user.firstName} ${user.lastName}\`.trim() || 'My Camp';`
- **Why it’s wrong:** `user.campName` is not set during role selection (camp name is entered later on the camp edit page). The fallback to `firstName + lastName` made the camp name and slug the user’s name (e.g. "Mo Costa" → slug `mo-costa`).
- **Result:** "My Camp" linked to `/camps/mo-costa`; slug should come from the camp name (or placeholder "My Camp" until they save).

### Visibility / Server error
- **Where:** `server/routes/camps.js` GET `/api/camps/public/:slug`.
- **Contributors:** (1) Verbose logging used `JSON.stringify(camp, null, 2)` on a Mongoose document, which can throw (circular refs / getters). (2) Private camp + unauthorized user was returning 404; requirement was to return 403 for “exists but not allowed” so it doesn’t look like “not found” and never return 500 for that case. (3) Member list mapping assumed every member had `firstName`/`lastName`; missing or populated shapes could cause issues.
- **Result:** Camp Lead (owner) should always be allowed to view their own camp; the 500 was likely from the logging or downstream code, not from the visibility check itself.

---

## 2. Exact Code Locations

| File | Area |
|------|------|
| `server/routes/onboarding.js` | Camp name used for slug (line ~112) |
| `server/routes/camps.js` | GET `/api/camps/public/:slug`: logging, visibility, member mapping |

---

## 3. Minimal Code Fix (Summary)

### Onboarding (slug)
- **Change:** Do not use the user’s personal name as camp name.
- **Logic:** Use only `user.campName` (if present and non-empty) or the placeholder `'My Camp'`.
- **Snippet:**
  - Before: `const campName = user.campName || \`${user.firstName} ${user.lastName}\`.trim() || 'My Camp';`
  - After: `const campName = (user.campName && String(user.campName).trim()) || 'My Camp';`

### Public camp route (visibility + stability)
- **Slug param:** Validate `slug` and return 400 if missing/invalid.
- **Order:** Return 404 as soon as camp is not found, before any logging that uses `camp`.
- **Logging:** Remove `JSON.stringify(camp, null, 2)`. Log only safe fields (e.g. `camp._id`, `camp.name`).
- **Visibility:** If camp is private and the user is not camp admin and not system admin, return **403** with a clear message (e.g. "This camp profile is not publicly visible") instead of 404.
- **Members:** Wrap `findManyMembers` in try/catch; default to `[]` on error. Map members with fallbacks: `firstName ?? member.user?.firstName ?? ''`, same for `lastName`, and safe handling for `profilePhoto`, `bio`, `skills`.

No change to:
- Who can view: Camp Lead (owner) and system admin still bypass private checks via existing `isCampAdmin` / `isSystemAdmin`.
- "My Camp" link: Still uses camp slug from GET `/api/camps/my-camp` (Navbar); after they save camp name, PUT `/camps/my-camp` continues to update `name` and `slug` from `campName`.

---

## 4. Migration Required?

**No.**

- New camps get the correct placeholder slug from onboarding; when the user saves the real camp name, the existing PUT `/camps/my-camp` logic updates `name` and `slug`.
- Existing camps with wrong slugs (e.g. `mo-costa`): no automatic migration. Affected camps can be fixed by the owner editing and saving the camp name (which regenerates the slug), or by a one-off script if you choose to add one later.

---

## 5. QA Results Summary

### New camp creation
- [ ] Create new camp with name "Mudskippers" (via camp edit after onboarding).
- [ ] Confirm slug = `mudskippers` and DB record has correct `name` and `slug`.
- [ ] "My Camp" links to `/camps/mudskippers` and page loads.

### Placeholder slug (onboarding only, before first save)
- [ ] Complete onboarding as Camp Lead; do not enter camp name yet.
- [ ] Confirm camp is created with name "My Camp" and slug `my-camp` (or `my-camp-2` if collision).
- [ ] "My Camp" links to `/camps/my-camp` and page loads for the owner.
- [ ] After saving camp name "Test Camp", slug updates and "My Camp" links to `/camps/test-camp`.

### Private visibility
- [ ] Set camp visibility to Private.
- [ ] Camp Lead (owner) can open "My Camp" and see the profile (no server error, no 403).
- [ ] System Admin can open the camp (e.g. from admin or direct URL) and see the profile.
- [ ] Logged-out or non-member user opening the same camp URL gets **403** (or appropriate message), not 500.

### Edge cases
- [ ] Camp name with spaces (e.g. "Mo Costa Camp") → slug normalized (e.g. `mo-costa-camp`).
- [ ] Duplicate camp name → slug gets suffix (e.g. `my-camp-2`).
- [ ] Refresh after onboarding: camp slug still correct; no fallback to user name.

### Regression
- [ ] Existing camps with correct slugs still resolve.
- [ ] Admin panel and roster members behave as before.
