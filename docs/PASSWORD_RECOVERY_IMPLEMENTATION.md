# Password Recovery – Implementation Summary

Secure forgot-password and reset-password flow with token-based reset links, rate limiting, and clear UX.

---

## 1. Current Auth Architecture Summary

- **Auth routes:** `server/routes/auth.js` (login, register, /me, change-password). JWT via `authenticateToken`; passwords hashed with bcrypt (12 rounds) in User pre-save.
- **Email:** Resend via `server/services/emailService.js`; `sendPasswordResetEmail(user, resetUrl, expiryHours)` used for reset links.
- **User model:** Mongoose; `authProviders` indicates `password` vs OAuth. No previous reset token fields; now added.
- **Validation:** express-validator on auth routes; password min length 6.

---

## 2. Schema Updates

**User model** (`server/models/User.js`):

- `passwordResetToken` (String, default null, `select: false`) – stores bcrypt hash of the reset token.
- `passwordResetTokenExpiry` (Date, default null, `select: false`) – expiry time.

Tokens are single-use: after a successful reset, both fields are cleared. New forgot-password request overwrites any existing token for that user.

---

## 3. Backend Implementation

### POST /auth/forgot-password

- **Rate limit:** `forgotPasswordLimiter` (5 requests per 15 minutes per IP) applied to this route only.
- **Input:** `{ email }` (validated, normalized to lowercase).
- **Logic:**
  1. Normalize email; find user by email (with `authProviders`).
  2. If no user or user has no `password` in `authProviders` → **404** `"No account found with that email address."`
  3. Generate raw token: `crypto.randomBytes(32).toString('hex')`.
  4. Hash with bcrypt (12 rounds); set expiry to `now + PASSWORD_RESET_EXPIRY_HOURS` (default 1, configurable via `PASSWORD_RESET_EXPIRY_HOURS`).
  5. Update user: `passwordResetToken`, `passwordResetTokenExpiry` (previous token overwritten).
  6. Build reset URL: `{CLIENT_URL}/reset-password?token={encodeURIComponent(rawToken)}` (default base `https://www.g8road.com`).
  7. Call `sendPasswordResetEmail(user, resetUrl, expiryHours)`.
  8. Return **200** with message that a reset link was sent (no disclosure of whether email exists beyond the 404 case).

- **Security:** Raw token only in email URL; never logged. Same response for rate limit (429) and server errors (500) as per existing patterns.

### POST /auth/reset-password

- **Input:** `{ token, newPassword }` (token required; newPassword min 6 chars).
- **Logic:**
  1. Find all users with non-null `passwordResetToken` and `passwordResetTokenExpiry > now()` (select `+passwordResetToken`).
  2. For each, `bcrypt.compare(token, user.passwordResetToken)`; stop at first match.
  3. If no match → **400** `"Invalid or expired reset link. Request a new password reset."`
  4. Load full user doc; set `password = newPassword`, `passwordResetToken = undefined`, `passwordResetTokenExpiry = undefined`; `save()` (User pre-save hashes password).
  5. Return **200** with success message.

- **Security:** Token only compared via bcrypt; not logged. Single-use: token cleared on success.

---

## 4. Email Sending Integration

- **Function:** `sendPasswordResetEmail(user, resetUrl, expiryHours)` in `server/services/emailService.js`.
- **Subject:** `Reset Your G8Road Password`.
- **Body:** Greeting, reset link (button + plain URL), expiration notice (e.g. 1 hour), “if you didn’t request this, ignore”, support contact (`SUPPORT_EMAIL` or `support@g8road.com`).
- **Parameters:** Caller passes full `resetUrl` (including token); email layer does not handle token generation or storage.

---

## 5. Frontend Components

- **Login** (`client/src/pages/auth/Login.tsx`): Already has “Forgot your password?” link to `/forgot-password`. No change.
- **ForgotPassword** (`client/src/pages/auth/ForgotPassword.tsx`): New page. Email input, submit, inline validation, loading state. States: idle, submitting, success, not_found (404), error, network_error. Success/error message on same page. “Back to Sign In” link.
- **ResetPassword** (`client/src/pages/auth/ResetPassword.tsx`): New page at `/reset-password`. Reads `token` from query (`?token=...`). If no token: show “Invalid reset link” and link to request new one. Form: new password, confirm password, validation (min length, match), submit. Handles invalid/expired token (400) and success (message + redirect to login after 3s).
- **Routes** (`client/src/App.tsx`): Added `/forgot-password` → `ForgotPassword`, `/reset-password` → `ResetPassword`.

---

## 6. Security Validation Summary

- **Token:** Cryptographically secure (`crypto.randomBytes(32).toString('hex')`); stored only as bcrypt hash; not logged.
- **Single-use:** Token and expiry cleared on successful reset.
- **Expiry:** Enforced server-side (query `passwordResetTokenExpiry > now()`).
- **Rate limit:** Forgot-password limited to 5 per 15 min per IP.
- **Email existence:** 404 only when no account or OAuth-only; success message when email exists and is sent (no “email doesn’t exist” on success path).
- **Password policy:** Same as rest of app (min 6 chars); validated on reset.
- **No stack traces:** Generic “Server error” in production responses.

---

## 7. QA Results

See **docs/QA_CHECKLIST.md** section **“Password Recovery”** for the full checklist. Summary:

- **Functional:** Forgot link, existing email gets reset email, non-existing gets explicit error, reset link format, expired/used token fail, valid token works, password updated and login works, redirect after reset.
- **Security:** Token not in logs, rate limit, weak password rejected, no stack traces.
- **Edge cases:** Email case normalization, multiple requests invalidate prior token, OAuth-only returns “No account found”.

---

*Last updated: Password Recovery feature implementation.*
