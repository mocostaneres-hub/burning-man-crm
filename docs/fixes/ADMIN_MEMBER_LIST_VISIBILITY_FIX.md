# System Admin Member List Visibility Fix

**Issue:** Some members (e.g., Casie Clymer – Roster Member and Camp Lead for Mudskippers) do not appear in the System Admin member list at https://www.g8road.com/admin.

**Status:** Fixed (root cause: pagination; only first page was loaded).

---

## Step 1 – Member List Logic (Summary)

| Layer | Location | Behavior |
|-------|----------|----------|
| **Frontend** | `client/src/pages/admin/AdminDashboard.tsx` | `loadUsers()` calls `GET /admin/users` (no params), then sets `users` from response and filters to `accountType === 'personal'` for the Users tab. |
| **API** | `GET /api/admin/users` in `server/routes/admin.js` | Uses `db.findUsers()`, then filters out `accountType === 'camp'`, applies optional `search`, `accountType`, `status`, sorts by `createdAt` desc, **paginates with default `page=1`, `limit=20`**, enriches with camp name, returns `{ data, totalPages, currentPage, total }`. |
| **Backend filter** | Same route | Only exclusion: `user.accountType !== 'camp'`. Personal, admin, and unassigned are included. No filter by role (Camp Lead vs member); that is roster data, not User.accountType. |
| **Frontend filter** | AdminDashboard `filteredUsers` | Only users with `accountType === 'personal'` are shown in the Users tab. Admins (system or camp) are in the API response but hidden in the UI. |

So:

- **Query used:** All users from DB, then exclude camp accounts; optional search/accountType/status; sort by `createdAt` desc; **slice for one page**.
- **Filters:** Backend excludes only `accountType === 'camp'`. Frontend then restricts display to `accountType === 'personal'`.
- **Where filtering happens:** Backend does DB result + in-memory filter + pagination slice. Frontend does in-memory filter for display.
- **Camp leads vs roster members:** Not filtered differently; both are typically `accountType === 'personal'`. Camp Lead is a roster role, not a user accountType.

---

## Step 2 – Role & Permission Audit

- **System Admin:** Determined by `requireAdmin` and (for impersonation) `accountType === 'admin' && !req.user.campId`. System Admin has global access; no camp scoping is applied to the admin users list.
- **Admin users list:** No camp-based scoping; it’s a global list of non-camp users.
- **Role combinations:** A user who is both Roster Member and Camp Lead is still one User with `accountType === 'personal'`. No JOIN or role logic in this route excludes multi-role users.
- **Enrichment:** For each user we optionally look up camp name (via `campId` or, in MongoDB, via Member + Roster with `isCampLead`). This only adds fields; it does not remove users. `Member.findOne({ user })` returns one member if any; multiple memberships don’t remove the user from the list.

Conclusion: visibility is not restricted by role or camp; it’s restricted by **pagination** (only first page returned) and by **frontend** (only personal accounts shown).

---

## Step 3 – Data Integrity (What to Verify for Casie Clymer)

To confirm she should appear:

1. **User record:** Exists in `User` collection with a valid `_id`.
2. **accountType:** Should be `'personal'` (not `'camp'`) so she’s included in the backend list and shown in the Users tab.
3. **isActive:** Not used in the default backend filter; only when `status` query is sent. So active/inactive doesn’t exclude by default.
4. **Soft delete:** No soft-delete filter found in this route; if you add one later, ensure it doesn’t exclude her.
5. **Camp/roster:** She’s linked to Mudskippers via Member/Roster; enrichment may set `campName` / `campLeadCampName`. No impact on inclusion.

Example checks (MongoDB):

```javascript
// User exists and is included in “non-camp” set
db.users.findOne(
  { $or: [
    { firstName: /Casie/i, lastName: /Clymer/i },
    { email: /casie/i }
  ]},
  { accountType: 1, isActive: 1, createdAt: 1 }
)
// Expect accountType: 'personal' to appear in admin list (once past pagination).

// Count non-camp users (to see how many pages at limit=20)
db.users.countDocuments({ accountType: { $ne: 'camp' } })
```

---

## Step 4 – Common Failure Patterns Found

| Pattern | Present? | Note |
|---------|----------|------|
| Query filters only by primary role | No | We filter by accountType only; Camp Lead is not an accountType. |
| Filtering by “member” but excluding “camp lead” | No | No such filter. |
| Missing OR for multi-role users | N/A | Single User record per person. |
| Admin scoped by camp | No | List is global. |
| Caching returning stale list | Not observed | No cache in this path. |
| **Pagination + no high limit** | **Yes** | **Default `limit=20`; frontend did not pass a higher limit, so only the first 20 users (by createdAt desc) were returned. Users like Casie on later pages never appeared.** |

---

## Step 5 – Fix Implemented

### Root cause

The System Admin dashboard was calling `GET /admin/users` with no query params, so the backend used default **page=1, limit=20**. Only the first 20 non-camp users (newest by creation date) were returned. Any member not in that first page (e.g., Casie Clymer) did not appear. The Camps list already requested a high limit (e.g. 1000); the Users list did not.

### Code change (minimal, production-safe)

**File:** `client/src/pages/admin/AdminDashboard.tsx`

1. **Request a high limit** when loading the admin users list so the full list is returned (aligned with camps):

   - Before: `apiService.get('/admin/users')` → backend used `limit=20`.
   - After: `apiService.get('/admin/users?limit=1000')` so System Admin sees up to 1000 users in one request.

2. **Response parsing:** Use the backend’s actual shape `{ data: users[] }` so the list is set correctly:

   - Before: `response.users || response.data?.users || response.data` (comment said “users[]” but API returns `data`).
   - After: `response.data ?? response.users` so we use the array from `data` when present.

No backend change required; the route already accepts `limit` from the query. No change to who is included (still all non-camp users); only how many are requested per request.

### Optional backend hardening

- Cap `limit` in `GET /api/admin/users` (e.g. `Math.min(parseInt(limit) || 20, 5000)`) to avoid oversized responses. Not required for the fix.

### Regression tests (suggested)

1. **Multi-role user appears:** User with `accountType === 'personal'` who is both Roster Member and Camp Lead appears in the System Admin Users list when their creation order would put them beyond the first 20.
2. **Camp Lead appears:** Same as above; Camp Lead (personal account) appears.
3. **Roster member appears:** Personal account that is only a roster member (no Camp Lead) appears.
4. **Camp accounts not in Users list:** Users with `accountType === 'camp'` do not appear in the Users list (they are in Camps / camp context).
5. **Inactive/soft-deleted:** If you add filters for `isActive` or soft delete, ensure tests confirm intended exclusion and that normal active members still appear.

---

## Summary

- **Cause:** Only the first 20 non-camp users were loaded (default pagination); no high limit was requested.
- **Fix:** Frontend requests `/admin/users?limit=1000` and uses `response.data` for the users array.
- **Scope:** Visibility logic unchanged; list is still global, non-camp only; frontend still shows only personal accounts. No architecture change.
