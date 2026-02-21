# Promote to System Admin – Implementation Summary

This document summarizes the implementation that allows an existing System Admin to promote another camp account (or any user) to full System Admin rights.

---

## 1. Current Role Architecture Summary

### How System Admin is determined

- **Primary:** `User.accountType === 'admin' && !User.campId` (admin account with no camp = system admin).
- **New:** `User.isSystemAdmin === true` (promoted by another system admin; independent of `accountType`).
- **Fallback:** Presence in **Admin** collection (separate model) with `role: 'super-admin'` or active record grants admin dashboard access; for **system-admin-only** actions (e.g. impersonate, promote), code also checks the two conditions above or `Admin.role === 'super-admin'`.

### Models

- **User** (`server/models/User.js`): `accountType` (`'personal' | 'camp' | 'admin'`), `campId`, `role` (`'member' | 'camp_lead' | 'unassigned'`). No separate Role model; roles are a mix of `accountType`, `campId`, and Member/Roster (Camp Lead).
- **Admin** (`server/models/Admin.js`): Optional; links a User to admin capabilities with `role: ['super-admin', 'moderator', 'support']` and granular `permissions`. Used as fallback when `accountType !== 'admin'`.

### Authorization

- **requireAdmin** (middleware): Grants access to `/admin` if user has `accountType === 'admin'`, or `User.isSystemAdmin`, or an active Admin record. Sets `req.admin` and `req.isSystemAdmin` where applicable.
- **requireSystemAdmin**: New middleware used for promote and (conceptually) impersonate; allows only when `(accountType === 'admin' && !campId) || user.isSystemAdmin` (or Admin super-admin where used).
- **Scoping:** System Admin is **global** (not scoped to a camp). Camp Lead / Roster Member are per-camp (Member + Roster). Permissions are centralized in `server/middleware/auth.js` and `server/utils/permissionHelpers.js`; some routes (camps, admin, invites) also inline system-admin checks.

### Admin dashboard user management

- GET `/api/admin/users`: Returns users (excluding camp accounts from the list); enriched with camp name. Now includes `isSystemAdmin` from User when present.
- PUT `/api/admin/users/:id`: General admin update (requires requireAdmin).
- POST `/api/admin/users/:id/promote-to-system-admin`: New; requires **system admin** only; sets `User.isSystemAdmin = true` and records audit.

---

## 2. Minimal Schema Change

- **User** model: added optional boolean `isSystemAdmin`, default `false`. No migration of existing users required (existing docs read as false).
- No change to Admin or other collections.

---

## 3. Backend Implementation

### New/updated pieces

- **User schema** (`server/models/User.js`): Added `isSystemAdmin: { type: Boolean, default: false }`.
- **Auth middleware** (`server/middleware/auth.js`):
  - `isSystemAdminUser(user)` helper.
  - `requireAdmin`: now treats `user.isSystemAdmin` as admin and sets `req.isSystemAdmin`; also sets `req.isSystemAdmin` for Admin collection when `role === 'super-admin'`.
  - New `requireSystemAdmin`: allows only system admin (accountType admin with no camp, or `user.isSystemAdmin`, enforced in route for impersonate).
- **Admin routes** (`server/routes/admin.js`):
  - POST `/users/:id/promote-to-system-admin`: `authenticateToken`, `requireSystemAdmin`. Validates target user exists, not already system admin, is active; updates `isSystemAdmin: true`; records `recordActivity('MEMBER', targetUserId, performerId, 'PROMOTE_TO_SYSTEM_ADMIN', { action, performedBy, targetUserId, timestamp })`; returns updated user.
- **Impersonation** (`server/routes/admin.js`): System-admin check updated to include `user.isSystemAdmin`; target check updated so that promoted system admins cannot be impersonated.
- **Auth /me** (`server/routes/auth.js`): Response user object now includes `isSystemAdmin: (accountType === 'admin' && !campId) || !!user.isSystemAdmin` in all branches (including Camp Lead and catch fallback).
- **Camps public route** (`server/routes/camps.js`): View-private-camp check updated to treat `req.user.isSystemAdmin` as system admin.
- **permissionHelpers** (`server/utils/permissionHelpers.js`): `canManageCamp` treats `user.isSystemAdmin` as system admin.

### Audit logging

- Action: `PROMOTE_TO_SYSTEM_ADMIN`.
- Stored via existing `recordActivity('MEMBER', targetUserId, performerId, 'PROMOTE_TO_SYSTEM_ADMIN', details)`.
- `details`: `action`, `performedBy`, `targetUserId`, `timestamp`. ActivityLog uses `entityType: 'MEMBER'`, `entityId: targetUserId` (the promoted user).

---

## 4. Frontend Changes

- **Types** (`client/src/types/index.ts`): `User` extended with optional `isSystemAdmin?: boolean`.
- **AdminDashboard** (`client/src/pages/admin/AdminDashboard.tsx`):
  - `useAuth()` to read `currentUser`.
  - **Account Type column:** Shows a “System Admin” badge when `user.isSystemAdmin || (user.accountType === 'admin' && !user.campId)`.
  - **Actions column:** “Promote” button (ShieldCheck icon) only when `currentUser?.isSystemAdmin` and target is **not** already system admin: `!((user.accountType === 'admin' && !user.campId) || user.isSystemAdmin)`.
  - **Promote flow:** Click Promote → confirmation modal (“Are you sure you want to grant full system access?” with target name/email); on confirm, POST `/admin/users/:id/promote-to-system-admin`, then refresh user list and show success; modal closes.
- **Auth context:** No change; `/auth/me` now returns `isSystemAdmin`, so `currentUser.isSystemAdmin` is set after login/refresh.

---

## 5. Security Validation

- **Only system admins can promote:** Route uses `requireSystemAdmin`; Camp Lead and Roster Member do not satisfy this (unless they are also system admins).
- **Non-admin cannot hit endpoint:** 401 without auth; 403 if not system admin.
- **No self-demote in this flow:** Endpoint only promotes (sets `isSystemAdmin: true`); there is no demote in this action.
- **Server-side only:** Promote button is hidden for non–system admins, but enforcement is on the server (403 for unauthorized call).
- **Already system admin:** Idempotent; returns 200 with “User is already a system admin” and does not overwrite.
- **Inactive user:** Returns 400 “Cannot promote an inactive user. Activate the account first.”

---

## 6. QA Checklist (Summary)

See **docs/QA_CHECKLIST.md** section **“Promote to System Admin”** for the full list. Summary:

- Permission: Only system admins see Promote; Camp Lead/Roster cannot promote; direct API call returns 403.
- Functional: Promote button visibility; confirmation modal; promotion succeeds and badge appears; promoted user can access `/admin` and full system features.
- Edge cases: Already-admin user; inactive user; audit log shows `PROMOTE_TO_SYSTEM_ADMIN`.
- Regression: Existing roles and camp associations preserved.

---

*Last updated: implementation of Promote to System Admin feature.*
