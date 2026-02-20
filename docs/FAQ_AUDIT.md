# FAQ System Audit

## 1. Current Flow Summary

### How FAQ visibility is determined

- **Backend (source of truth):** `GET /api/help/faqs` in `server/routes/help.js` uses optional auth to build an `audienceFilter` array and calls `db.findFAQs({ isActive: true, audience: audienceFilter })`.
- **Audience rules:**
  - **Unauthenticated:** `['both', 'homepage']` — shared + homepage-only.
  - **Camp:** `['both', 'camps']` — shared + camp-only.
  - **Personal (member):** `['both', 'members']` — shared + member-only.
  - **Admin:** `['both', 'camps', 'members', 'homepage']` — all.
- **Shared visibility:** Articles with `audience: 'both'` are shown to both camp and member contexts; the backend includes `'both'` in every role’s filter, so shared visibility is consistent.
- **Filtering locations:**
  - **DB/API:** Backend applies `isActive` and `audience` in the DB layer (intended). Mock DB supports `audience` as an array (`query.audience.includes(faq.audience)`). MongoDB currently receives `audience: [array]`, which Mongoose treats as equality to that array, so **no documents match** when using MongoDB — **bug**.
  - **Frontend:** `Help.tsx` calls the same API then filters again by `getTargetAudience()` (path: `/camp/help` → camps, `/member/help` → members, `/help` → admin or `'both'`). So visibility is **duplicated**: backend by auth, frontend by path. For normal flows (camp on `/camp/help`, etc.) they align; for unauthenticated on `/help`, frontend keeps only `audience === 'both'` and drops `homepage` even though the API returns both — **inconsistency**.
- **Home page:** `client/src/components/FAQ.tsx` uses `GET /help/faqs` with no client-side audience filter; it displays whatever the API returns (correct).
- **Admin:** `GET /api/admin/faqs` returns all FAQs with no filter; FAQ admin UI uses `/admin/faqs` and does not apply visibility logic (correct).

### Summary table

| Context              | Backend filter (audience)     | Frontend (Help.tsx)     |
|----------------------|------------------------------|--------------------------|
| Unauthenticated /help| both, homepage               | only `both` (homepage dropped) |
| Camp /camp/help      | both, camps                  | camps \|\| both          |
| Member /member/help  | both, members                | members \|\| both        |
| Admin /help          | all                          | all                      |

---

## 2. Audit Findings

### A. Structural issues

- **MongoDB audience query:** Adapter passes `query` straight to `FAQ.find(query)`. When `audience` is an array (e.g. `['both', 'camps']`), Mongoose interprets it as “audience equals this array”; no FAQ has `audience` as an array, so **MongoDB returns no FAQs**. Mock DB correctly treats array as “audience in list.”
- **adminFAQs restore:** Uses `FAQ.deleteMany({})` and `FAQ.insertMany(...)` but **`FAQ` is never required** in `adminFAQs.js`, so the restore route throws `ReferenceError` when run (MongoDB). Restore is also MongoDB-only; mock DB has no bulk delete/insert for FAQs.
- **Schema vs usage of `homepage`:** Model allows `audience: 'homepage'`. Backend sends homepage to unauthenticated users; Help page then filters to `audience === 'both'` only, so **homepage FAQs never appear on Help** for logged-out users. Either include homepage in the “both” path or document that homepage is for landing only.
- **No `campId` / `memberAccountId`:** Visibility is **only** by `audience` (both/camps/members/homepage). There is no per-camp or per-member-account scoping; the task’s “camp-specific” and “member account–specific” mean “visible in camp context” vs “visible in member context,” not per-entity IDs. No nullable camp/member ID combinations to worry about.
- **Index:** `faqSchema.index({ isActive: 1, audience: 1 });` is useful; for MongoDB, when we switch to `audience: { $in: [...] }`, the index can still be used for the `$in` match.

### B. Logic issues

- **MongoDB audience bug:** As above; camp/member/admin get empty FAQ list when using MongoDB.
- **Precedence:** No conflict; a single `audience` value per FAQ and backend uses one filter array per role. Shared visibility is “both” included in every role’s array.
- **Edge case – user in multiple camps:** Not applicable; visibility is by account type (camp vs personal) and path, not by camp membership. No multi-camp edge case for FAQs.
- **Security:** Visibility is enforced by the **backend** (different audience filters per auth). Frontend filtering in Help is redundant for security but should match backend so UX is consistent (e.g. show homepage on /help when API returns it).
- **Performance:** Backend returns only the FAQs for the current audience; once the MongoDB query is fixed, no extra load. Help fetches once then filters in memory (small set, fine).

### C. UX / content issues

- **Home FAQ component:** Uses array index as React key (`key={index}`); should use `faq._id` when available to avoid re-mount issues and align with list identity.
- **Help page:** Unauthenticated users on `/help` do not see `homepage` FAQs because of client-side filter; if homepage is “landing only,” consider documenting or renaming to avoid confusion.
- **FAQAdmin:** Supports `homepage` in the audience dropdown; admin restore set does not include any `audience: 'homepage'` entries. No metadata such as tags, priority beyond `order`, or explicit “published at” (we have `isActive`).

---

## 3. Proposed Refactors (targeted changes)

### 3.1 Centralize audience filter in backend (current behavior, fix MongoDB)

**Problem:** MongoDB `findFAQs` does not support “audience in list.”

**Change:** In `server/database/databaseAdapter.js`, when calling Mongoose `FAQ.find()`, if `query.audience` is an array, convert it to `{ $in: query.audience }` so both mock and MongoDB behave the same.

```javascript
// databaseAdapter.js – findFAQs
async findFAQs(query = {}) {
  if (this.useMongoDB) {
    const FAQ = require('../models/FAQ');
    const mongoQuery = { ...query };
    if (Array.isArray(mongoQuery.audience)) {
      mongoQuery.audience = { $in: mongoQuery.audience };
    }
    return await FAQ.find(mongoQuery).sort({ category: 1, order: 1 });
  } else {
    return await this.mockDB.findFAQs(query);
  }
}
```

### 3.2 adminFAQs restore: support both backends (implemented)

**Problem:** Restore used `FAQ.deleteMany` / `FAQ.insertMany` without requiring the model and only worked with MongoDB.

**Change (done):** Restore now uses only the adapter: fetch all FAQs with `db.findFAQs({})`, delete each with `db.deleteFAQ(id)`, then create each default FAQ with `db.createFAQ(data)`. This works for both MongoDB and mock DB and does not require the FAQ model in the route.

### 3.3 Align Help.tsx unauthenticated filter with backend

**Problem:** For `targetAudience === 'both'`, Help keeps only `audience === 'both'`, so API-returned `homepage` FAQs are hidden.

**Change:** When target audience is `'both'`, show FAQs that are `audience === 'both'` **or** `audience === 'homepage'` so unauthenticated Help matches what the API returns:

```ts
} else if (targetAudience === 'both') {
  filteredFaqs = allFaqs.filter(faq => faq.audience === 'both' || faq.audience === 'homepage');
}
```

(And ensure the FAQ type in Help includes `'homepage'` in `audience` if needed.)

### 3.4 Optional: Centralized visibility helper

To avoid duplicating the “audience filter for role” logic, add a small helper (e.g. in `server/utils/faqVisibility.js`) that returns the audience array for a given `req.user` (or null for unauthenticated), and use it in `help.js`. Frontend can keep path-based filtering for UX, but the single source of truth remains the API.

### 3.5 Suggested tests for visibility

- **Backend:** For `GET /api/help/faqs`: (1) no token → only `both` and `homepage` FAQs; (2) camp token → only `both` and `camps`; (3) personal token → only `both` and `members`; (4) admin token → all. Assert both count and that no wrong-audience FAQ appears.
- **Adapter:** `findFAQs({ isActive: true, audience: ['both', 'camps'] })` returns FAQs whose `audience` is either `both` or `camps`, for both mock and MongoDB (if both are tested).

---

## 4. New FAQ Recommendations (by visibility type)

Below are suggested FAQs that fit existing categories and product behavior. Use “Camp” = `audience: 'camps'`, “Member” = `audience: 'members'`, “Shared” = `audience: 'both'`, “Global/Homepage” = `audience: 'homepage'` for unauthenticated/landing.

---

### Camp-only

- **How do I assign Camp Lead or Project Lead roles?**  
  **Category:** Camp Management  
  **Answer:** Go to your camp’s roster or member management. Open the member and use the role dropdown to set Camp Lead or Project Lead. Only existing Camp Leads can assign these roles. Project Leads can manage their project members and tasks.

- **How do I schedule orientation calls for applicants?**  
  **Category:** Camp Management  
  **Answer:** In Applications, you can set up call slots (dates/times) and let applicants pick a slot when they apply. Use the Call Slots or Application Management area to create slots and see who’s scheduled. Approved members can be added to your roster and roster-based features.

- **How do I use the roster for strike/EAP or volunteer shifts?**  
  **Category:** Members / Camp Management  
  **Answer:** Use the active roster to pull members into strike, EAP assignments, and volunteer shifts. Create an event with shifts or use roster-based tools; only members on the selected roster can be assigned. Keep your active roster up to date so assignments stay accurate.

---

### Member-only

- **Why do I need to complete my profile before applying to camps?**  
  **Category:** Applications  
  **Answer:** Camps use your profile (skills, playa name, plans, etc.) to evaluate fit. The system requires a complete profile before you can submit an application so camps see consistent, useful information and you have a better chance of being considered.

- **What does “pending orientation” or “call scheduled” mean on my application?**  
  **Category:** Applications  
  **Answer:** “Pending orientation” means the camp will reach out to schedule a call or next step. “Call scheduled” means you’ve chosen an orientation call time. After the call, the camp may move you to under review, approved, or rejected. Check your application or email for updates.

- **Can I withdraw my application and reapply later?**  
  **Category:** Applications  
  **Answer:** Yes. If you withdraw or your application is rejected, you can apply again to the same camp when they’re accepting applications. Withdraw or decline from your application page if your plans change.

---

### Shared (both)

- **How do I contact support?**  
  **Category:** Technical Support  
  **Answer:** Use the contact form on the Help page or the support option in the app. We aim to respond within 24 hours. For camp-specific issues, you can also reach out to your Camp Lead.

- **What if I forget my password?**  
  **Category:** Account Management  
  **Answer:** Use “Forgot your password?” on the login page and enter your email. You’ll get a link to reset your password. Use the same email you used to register.

- **How do I know which FAQs I see?**  
  **Category:** General  
  **Answer:** FAQs are tailored to your role: camp leads see camp management and shared topics; members see application and member topics; shared FAQs appear for everyone. On the Help page you’re automatically shown the set that matches your account type.

---

### Global / Homepage

- **What is G8Road?**  
  **Category:** General  
  **Answer:** G8Road is a platform for Burner camps and members: find camps, apply to join, manage rosters, orientation calls, volunteer shifts, and camp operations. It’s built for the community to connect and run camps more easily.

- **How do I get started as a camp or as a member?**  
  **Category:** General  
  **Answer:** Sign up and choose a Camp account (to manage a camp) or Personal account (to find and join camps). Camp accounts can create a camp profile and start inviting or accepting members; personal accounts can browse camps and apply. Check the Help section after logging in for role-specific guides.

---

End of audit.
