## Dues Status Rollout Plan

### Phase 1 - Schema + Backfill (No UI changes)
- Deploy `server/models/Roster.js` and `server/models/Camp.js` schema additions.
- Run `scripts/migrations/migrate-roster-dues-schema.js`.
- Run `scripts/migrations/backfill-roster-dues-status.js` once.
- Validate:
  - No roster member has null/empty `duesStatus`.
  - Legacy boolean-style data still present (`paid`/`duesPaid` where applicable).

### Phase 2 - API state machine
- Deploy `server/routes/rosters.js` transition validation and new preview/send endpoints.
- Monitor logs for:
  - Invalid transitions blocked.
  - Permission denied attempts.
  - Email failure responses (`status not updated` cases).

### Phase 3 - Frontend modal + enum states
- Deploy `client/src/pages/members/MemberRoster.tsx` enum-driven icon + action flow.
- Verify all email sends pass through preview modal first.
- Confirm PAID tooltip includes both `duesPaidAt` and `duesReceiptSentAt`.

### Phase 4 - Cleanup migration (after stability window)
- Require a stable period with no migration regressions.
- Add reporting/filtering by `UNPAID | INSTRUCTED | PAID` everywhere.
- Remove deprecated boolean references from UI/API only after production verification.

## Cleanup Migration Plan (Deferred)

Do **not** run this until telemetry confirms all writes and reads use enum states:
- Remove legacy boolean fields (`paid`/`duesPaid` compatibility paths).
- Remove legacy status normalization for `Paid`/`Unpaid`.
- Drop old API compatibility route usage.
- Update scripts/tests to enforce enum-only state.
