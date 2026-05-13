# Implementation Plan: Flexible Contribution Groups

## Overview

Implement the flexible contribution group feature across database, backend, and web layers. Tasks are sequenced so each layer builds on the previous: schema first, then controller logic, then routes, then API client, then UI pages and components, then router wiring, then property-based tests.

## Tasks

- [x] 1. Create database migration
  - Create `backend/migrations/add_flexible_contribution_groups.sql`
  - Add `group_type VARCHAR(10) NOT NULL DEFAULT 'njangi' CHECK (group_type IN ('njangi','flexible'))` column to `groups`
  - Add `pool_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00` column to `groups`
  - Add `goal_amount DECIMAL(12,2) NULL CHECK (goal_amount IS NULL OR goal_amount > 0)` column to `groups`
  - Create `flexible_contributions` table with all columns, constraints, and indexes as specified in the design
  - Create `flexible_disbursements` table with all columns, constraints, and indexes as specified in the design
  - _Requirements: 1.1, 5.1, 7.1, 11.1, 12.4_

  - [ ]* 1.1 Write migration smoke test
    - Verify `groups.group_type` column exists with CHECK constraint and default `'njangi'`
    - Verify `groups.pool_balance` column exists with type `DECIMAL(12,2)` and default `0.00`
    - Verify `groups.goal_amount` column exists as `DECIMAL(12,2) NULL` with CHECK constraint
    - Verify `flexible_contributions` table exists with all required columns, constraints, and indexes
    - Verify `flexible_disbursements` table exists with all required columns, constraints, and indexes
    - Verify existing `groups` rows are unaffected (`group_type = 'njangi'`, `goal_amount = NULL`)
    - _Requirements: 1.1, 1.6, 11.1_

- [x] 2. Implement `flexibleGroupController.js` — group lifecycle (create, activate, close, delete, update)
  - Create `backend/src/controllers/flexibleGroupController.js`
  - Implement `createFlexibleGroup`: validate name required, validate `goal_amount > 0` if provided, INSERT group with `group_type='flexible'` and `status='forming'`, INSERT admin member record
  - Implement `updateFlexibleGroupSettings`: allow updating name, description, max_members, visibility, goal_amount (null allowed); validate max_members >= current approved count; validate goal_amount > 0 if non-null
  - Implement `activateFlexibleGroup`: verify `group_type='flexible'`, verify `status='forming'`, count approved non-admin members (reject 400 if < 1), UPDATE status to `'active'`, notify all approved members
  - Implement `closeFlexibleGroup`: verify `group_type='flexible'`, verify `status='active'`, UPDATE status to `'completed'`, notify all approved members with remaining pool_balance
  - Implement `deleteFlexibleGroup`: verify `confirm === true`, count disbursements (reject 400 if 0), notify all approved members, hard-DELETE group (cascades)
  - _Requirements: 1.1–1.8, 2.1–2.5, 4.1–4.5, 9.1–9.4, 11.4–11.6, 12.1–12.6_

  - [ ]* 2.1 Write property test for goal_amount validation (P13 partial)
    - **Property 13 partial: goal_amount must be positive**
    - Use `fc.float({ max: 0 })` to generate non-positive values; assert create and update requests return HTTP 400
    - **Validates: Requirements 1.7, 11.6**

  - [ ]* 2.2 Write property test for activation guard (P4)
    - **Property 4: Activation guard — minimum non-admin member**
    - Generate groups with 0 vs ≥1 approved non-admin members; assert 400 for 0, 200 for ≥1
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 2.3 Write property test for activation notification fan-out (P11)
    - **Property 11: Notification fan-out on activation**
    - Use `fc.integer({ min: 1, max: 20 })` for member count; assert exactly N notification rows inserted
    - **Validates: Requirement 4.3**

  - [ ]* 2.4 Write property test for delete requires prior disbursement (P14)
    - **Property 14: Delete requires prior disbursement**
    - Groups with 0 disbursements → 400; groups with ≥1 disbursements + `confirm: true` → 200 and group gone
    - **Validates: Requirements 12.1, 12.2**

  - [ ]* 2.5 Write property test for delete confirmation flag (P14 partial)
    - **Property 14 partial: Delete confirmation flag required**
    - Generate requests with missing, false, null, or 0 confirm values; assert all return HTTP 400
    - **Validates: Requirement 12.6**

  - [ ]* 2.6 Write property test for delete notification fan-out (P12 partial)
    - **Property 12 partial: Delete notification fan-out**
    - Use `fc.integer({ min: 1, max: 20 })` for approved member count; assert exactly N notifications sent before deletion
    - **Validates: Requirement 12.3**

  - [ ]* 2.7 Write property test for group_type preservation on update (P10)
    - **Property 10: group_type field preserved across updates**
    - Generate arbitrary PATCH payloads; assert `group_type` remains `'flexible'` and `contribution_amount`/`cycle` fields are ignored
    - **Validates: Requirements 2.5, 10.1**

- [x] 3. Implement `flexibleGroupController.js` — contributions
  - Implement `contributeFlexible`: verify `group_type='flexible'`, verify `status='active'`, verify caller is approved member, validate `amount > 0`, INSERT `flexible_contributions` with `status='pending'`, process payment (tc_wallet / mtn_momo / orange_money branches), on success UPDATE contribution `status='completed'` and `pool_balance += amount` in a single transaction, notify admin; on failure UPDATE `status='failed'`
  - Implement `getFlexiblePoolSummary`: verify caller is approved member or admin, compute `goal_percent = goal_amount IS NULL ? null : MIN(FLOOR(pool_balance / goal_amount * 100), 100)`, return `pool_balance`, `goal_amount`, `goal_percent`, `contributor_count`; admin also receives per-member breakdown
  - Implement `getFlexibleContributions`: verify caller is approved member or admin; admin gets full records (name, amount, method, status, paid_at); member gets anonymised records (method, status, paid_at only)
  - _Requirements: 5.1–5.9, 6.1–6.6, 11.1–11.3_

  - [ ]* 3.1 Write property test for pool balance invariant (P1)
    - **Property 1: Pool balance invariant**
    - Generate sequences of N contributions and M disbursements; assert `pool_balance === sum(completed contributions) - sum(disbursements)`
    - **Validates: Requirements 5.2, 7.3**

  - [ ]* 3.2 Write property test for contribution amount positivity (P3)
    - **Property 3: Contribution amount positivity**
    - Use `fc.float({ max: 0 })` for amount; assert HTTP 400 and no record inserted
    - **Validates: Requirement 5.4**

  - [ ]* 3.3 Write property test for contribution atomicity (P6)
    - **Property 6: Contribution atomicity**
    - Simulate DB failure mid-transaction; assert both contribution record and pool_balance are unchanged
    - **Validates: Requirement 5.2**

  - [ ]* 3.4 Write property test for member privacy in contribution history (P7)
    - **Property 7: Member privacy in contribution history**
    - Generate any contribution list response to a non-admin approved member; assert no `name` or `amount` fields present
    - **Validates: Requirements 6.2, 6.4**

  - [ ]* 3.5 Write property test for non-member access rejection (P8)
    - **Property 8: Non-member access rejection**
    - Generate unauthenticated or non-member users; assert GET /flexible-pool, /flexible-contributions, /flexible-disbursements all return 403
    - **Validates: Requirements 6.6, 8.3**

  - [ ]* 3.6 Write property test for goal percent computation (P13)
    - **Property 13: Goal percent computation**
    - Use `fc.tuple(fc.float({ min: 0 }), fc.float({ min: 1 }))` for (balance, goal); assert `goal_percent === MIN(FLOOR(balance/goal*100), 100)`; assert null when goal_amount is null
    - **Validates: Requirements 11.1, 11.2**

- [x] 4. Implement `flexibleGroupController.js` — disbursements
  - Implement `createDisbursement`: verify `group_type='flexible'`, verify `status='active'`, verify `pool_balance >= amount` (else 400 with current balance), INSERT `flexible_disbursements` with `status='completed'` and UPDATE `pool_balance -= amount` in a single transaction, notify all approved members; do NOT call processPayment or walletService
  - Implement `getDisbursements`: verify caller is approved member or admin, return all records ordered by `created_at DESC` including admin name
  - Implement `updateDisbursement`: verify disbursement belongs to group, update only `note` and `recipient_description`
  - _Requirements: 7.1–7.6, 8.1–8.3_

  - [ ]* 4.1 Write property test for pool balance non-negativity (P2)
    - **Property 2: Pool balance non-negativity**
    - Generate disbursement amounts > current pool_balance; assert HTTP 400, pool_balance unchanged, no record inserted
    - **Validates: Requirement 7.2**

  - [ ]* 4.2 Write property test for no automated payment on disbursement (P5)
    - **Property 5: No automated payment on disbursement**
    - Generate any disbursement_method value; assert processPayment mock and walletService mock are never called
    - **Validates: Requirements 7.3, 7.4**

  - [ ]* 4.3 Write property test for disbursement atomicity (P6 disbursement side)
    - **Property 6: Disbursement atomicity**
    - Simulate DB failure mid-transaction; assert both disbursement record and pool_balance are unchanged
    - **Validates: Requirement 7.3**

  - [ ]* 4.4 Write property test for disbursement notification fan-out (P12)
    - **Property 12: Disbursement notification fan-out**
    - Use `fc.integer({ min: 1, max: 20 })` for approved member count; assert exactly N notification rows inserted
    - **Validates: Requirement 7.5**

- [x] 5. Implement `flexibleGroupController.js` — closed group guards
  - In `contributeFlexible` and `createDisbursement`, add check: if `status = 'completed'` return 400 "Group is not active"
  - _Requirements: 9.4_

  - [ ]* 5.1 Write property test for closed group rejection (P9)
    - **Property 9: Closed group rejects contributions and disbursements**
    - Generate any contribution or disbursement request on a group with `status='completed'`; assert HTTP 400 and pool_balance unchanged
    - **Validates: Requirement 9.4**

- [x] 6. Add guards to existing `groupController.js` for njangi-only routes
  - In `startGroup`: add `if (group.group_type === 'flexible') return res.status(400).json(...)` guard
  - In `contribute` (contributionController): add same guard
  - In `getGroupPool` (installmentController): add same guard
  - _Requirements: 1.6, 10.1_

- [x] 7. Register new routes in `backend/src/routes/groups.js`
  - Import all handlers from `flexibleGroupController.js`
  - Add `POST /:id/activate` → `activateFlexibleGroup`
  - Add `POST /:id/close` → `closeFlexibleGroup`
  - Add `DELETE /:id/flexible` → `deleteFlexibleGroup`
  - Add `POST /:id/flexible-contributions` → `contributeFlexible`
  - Add `GET /:id/flexible-contributions` → `getFlexibleContributions`
  - Add `GET /:id/flexible-pool` → `getFlexiblePoolSummary`
  - Add `POST /:id/flexible-disbursements` → `createDisbursement`
  - Add `GET /:id/flexible-disbursements` → `getDisbursements`
  - Add `PATCH /:id/flexible-disbursements/:disbursementId` → `updateDisbursement`
  - Apply `authenticate`, `requireProfileComplete`, and `requireGroupAdmin` middleware as specified in the design
  - _Requirements: 1.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 12.1_

- [x] 8. Add flexible group API functions to `web/src/api/groups.js`
  - Add `activateFlexibleGroup(groupId)`
  - Add `closeFlexibleGroup(groupId)`
  - Add `deleteFlexibleGroup(groupId)` — sends `DELETE` with body `{ confirm: true }`
  - Add `contributeFlexible(groupId, data)`
  - Add `getFlexibleContributions(groupId)`
  - Add `getFlexiblePoolSummary(groupId)`
  - Add `createDisbursement(groupId, data)`
  - Add `getDisbursements(groupId)`
  - Add `updateDisbursement(groupId, disbursementId, data)`
  - _Requirements: 1.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 12.1_

- [x] 9. Create `web/src/pages/CreateFlexibleGroup.jsx`
  - Create new page at route `/groups/create-flexible`
  - Include fields: group name (required), description (optional), max members (optional), goal amount (optional, positive XAF number with helper text "Set a fundraising target to display a progress bar"), visibility selector (public / private / region)
  - Send `group_type: 'flexible'` and optional `goal_amount` in the POST payload
  - Show validation error if `goal_amount` is provided but ≤ 0
  - On success, navigate to `/groups/:id` (which will redirect to `/groups/:id/flexible`)
  - _Requirements: 1.1–1.8_

- [x] 10. Create `web/src/pages/FlexibleGroupDetail.jsx` — skeleton and data loading
  - Create new page at route `/groups/:id/flexible`
  - On mount, fetch group details, pool summary (`getFlexiblePoolSummary`), contributions (`getFlexibleContributions`), and disbursements (`getDisbursements`) in parallel
  - Render Hero section: group name, description, status badge, member count, visibility badge
  - Render Members Table (same structure as existing `GroupDetail.jsx`)
  - Render Invite Link section (same as existing `GroupDetail.jsx`)
  - _Requirements: 6.1, 8.1, 10.1_

- [x] 11. Implement Pool Summary Card with goal progress bar in `FlexibleGroupDetail.jsx`
  - Render Pool Summary Card showing current pool balance (XAF) and contributor count
  - When `goal_amount` is set (non-null), render a progress bar: `<progress value={goal_percent} max={100} />` with label "X XAF / Y XAF — Z%"
  - When `goal_amount` is null, show raw pool balance only with no progress bar
  - Admin sees per-member breakdown table below the summary card
  - _Requirements: 6.1, 6.2, 11.1–11.3_

- [x] 12. Implement `ContributeFlexibleModal` in `FlexibleGroupDetail.jsx`
  - Inline modal component shown when approved member clicks "Contribute" button (visible only when `status='active'`)
  - Fields: amount input (number, min 1 XAF), payment method selector (MTN MoMo / Orange Money / TC Wallet), optional note
  - Submit button with loading state and error display
  - On success, refresh pool summary and contribution history
  - _Requirements: 5.1–5.9_

- [x] 13. Implement `DisbursementPanel` in `FlexibleGroupDetail.jsx`
  - Admin-only section with two sub-sections
  - **Create Disbursement form**: amount input (shows current pool balance as hint), recipient toggle (platform user search vs free-text external), disbursement method selector (TC Wallet / MTN MoMo / Orange Money / Bank Transfer / Manual), optional note, informational banner "No automated payment is made. You are responsible for transferring the funds externally.", submit button
  - **Disbursement History table**: columns Date, Amount, Recipient, Method, Note, Recorded by; ordered newest first; edit button per row (inline edit for note and recipient_description only)
  - _Requirements: 7.1–7.6, 8.1–8.3_

- [x] 14. Implement Contribution History section in `FlexibleGroupDetail.jsx`
  - Render contribution history table for all approved members
  - Admin view: show contributor name, amount, payment method, status, timestamp
  - Member view: show payment method, status, timestamp only (omit name and amount)
  - _Requirements: 6.3, 6.4_

- [x] 15. Implement Admin Actions section in `FlexibleGroupDetail.jsx`
  - Render Activate button (visible to admin when `status='forming'`)
  - Render Close Group button (visible to admin when `status='active'`)
  - Render Edit Settings button (always visible to admin; opens settings modal or navigates to edit page)
  - Render Delete Group button (visible to admin only when `disbursements.length >= 1`)
  - Delete Group button opens a confirmation dialog: "Are you sure you want to permanently delete this group? This action cannot be undone. All members will be notified." with Cancel and Delete Group (red/destructive) buttons
  - On delete confirmation, call `deleteFlexibleGroup(groupId)` and navigate to `/groups` on success
  - _Requirements: 4.1, 9.1, 12.1–12.6_

- [x] 16. Update router and navigation
  - In `web/src/App.jsx` (or router file), add routes:
    - `<Route path="/groups/:id/flexible" element={<FlexibleGroupDetail />} />`
    - `<Route path="/groups/create-flexible" element={<CreateFlexibleGroup />} />`
  - In `web/src/pages/GroupDetail.jsx`, add early-return redirect: `if (group?.group_type === 'flexible') return <Navigate to={`/groups/${id}/flexible`} replace />;`
  - In `web/src/pages/Groups.jsx`, add "Create Flexible Group" button alongside the existing "Create Njangi Group" button, and render a type badge (`Njangi` / `Flexible`) next to each group name in the listing
  - _Requirements: 10.1–10.3_
