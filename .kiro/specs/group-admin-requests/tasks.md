# Implementation Plan: Group Admin Request System

## Overview

Implement the admin request and voting workflow across database, backend, and web layers. Each task builds incrementally — schema first, then controller logic, then routes, then API client, then UI.

## Tasks

- [x] 1. Create database migration for admin request tables
  - Create `backend/migrations/add_admin_requests.sql` with `admin_requests` and `admin_request_votes` table definitions, indexes, and UNIQUE constraints matching the design schema
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 1.1 Write migration smoke test
    - Verify both tables exist with all required columns after migration runs
    - Verify UNIQUE constraints on `(group_id, requester_id)` and `(request_id, admin_id)` are enforced
    - Verify all three indexes are present
    - _Requirements: 11.1–11.5_

- [x] 2. Implement `adminRequestController.js` — submit and cap logic
  - Create `backend/src/controllers/adminRequestController.js`
  - Implement `submitAdminRequest`: verify caller is approved member, compute admin cap, check duplicate, INSERT into `admin_requests`, INSERT one vote row per admin, notify all admins
  - Export `computeAdminCap(approvedMemberCount)` as a named export for testability
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 4.1, 7.1, 7.5_

  - [ ]* 2.1 Write property test for admin cap formula (P1)
    - **Property 1: Admin cap formula correctness**
    - Use `fc.integer({ min: 0, max: 500 })` to verify `computeAdminCap(n) === Math.max(1, Math.floor(n / 10) * 3)` for all n
    - **Validates: Requirements 1.1**

  - [ ]* 2.2 Write property test for cap enforcement (P2)
    - **Property 2: Cap enforcement blocks submission**
    - Generate group states where `adminCount >= cap`; assert response is HTTP 409
    - **Validates: Requirements 1.2**

  - [ ]* 2.3 Write property test for role/status guard (P3)
    - **Property 3: Role and status guard on submission**
    - Generate all `(status, role)` combinations; assert only `approved+member` gets HTTP 201
    - **Validates: Requirements 2.1**

  - [ ]* 2.4 Write property test for vote row count at creation (P4)
    - **Property 4: Vote rows equal admin count at creation**
    - Use `fc.integer({ min: 1, max: 10 })` for admin count; assert exactly N vote rows inserted with `vote = NULL`
    - **Validates: Requirements 2.4, 3.1, 4.1**

  - [ ]* 2.5 Write property test for duplicate request guard (P5)
    - **Property 5: Duplicate request guard**
    - Submit twice for the same member; assert second call returns HTTP 409 with "A pending request already exists"
    - **Validates: Requirements 2.3**

  - [ ]* 2.6 Write property test for notification fan-out (P9)
    - **Property 9: Notification fan-out matches admin count**
    - Use `fc.integer({ min: 1, max: 10 })` for admin count; assert exactly N `admin_request_new` notification rows persisted
    - **Validates: Requirements 2.5, 7.1**

- [x] 3. Implement `adminRequestController.js` — vote logic
  - Implement `voteOnAdminRequest`: verify caller is admin, verify request is pending, verify caller has NULL vote row, record vote; on rejection set status rejected and notify requester + peer admins; on unanimous approval promote member and set status approved in a single transaction, notify requester
  - _Requirements: 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 3.1 Write property test for unanimous approval (P6)
    - **Property 6: Unanimous approval promotes member atomically**
    - Simulate N admins all approving; assert `member.role = 'admin'` AND `request.status = 'approved'` in same transaction
    - **Validates: Requirements 4.2, 6.1**

  - [ ]* 3.2 Write property test for single rejection closes request (P7)
    - **Property 7: Single rejection immediately closes request**
    - Simulate one admin rejecting with remaining votes still NULL; assert `request.status = 'rejected'` immediately
    - **Validates: Requirements 5.1**

  - [ ]* 3.3 Write property test for voting on non-pending request (P8)
    - **Property 8: Voting on non-pending request is blocked**
    - Generate resolved requests (`approved` or `rejected`); assert vote attempt returns HTTP 409 with "Request is no longer pending"
    - **Validates: Requirements 5.4**

  - [ ]* 3.4 Write property test for rejection notifications (P10)
    - **Property 10: Rejection notifications are complete and accurate**
    - Generate optional rejection reason string; assert requester gets exactly one `admin_request_rejected` notification and N-1 peers each get one `admin_request_rejected_peer` notification
    - **Validates: Requirements 5.2, 5.3, 7.3, 7.4**

- [x] 4. Implement `adminRequestController.js` — read endpoints
  - Implement `getAdminRequests`: admin-only, return all requests for group with requester name and per-admin vote summary (JOIN with users)
  - Implement `getMyAdminRequest`: member endpoint, return caller's own request or null
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add routes to `backend/src/routes/groups.js`
  - Import `submitAdminRequest`, `voteOnAdminRequest`, `getAdminRequests`, `getMyAdminRequest` from `adminRequestController`
  - Append four routes: `POST /:id/admin-requests`, `POST /:id/admin-requests/:requestId/vote`, `GET /:id/admin-requests`, `GET /:id/admin-requests/my`
  - Apply `requireProfileComplete` middleware to the two POST routes; read routes use `authenticate` only (already applied via `router.use`)
  - _Requirements: 2.1, 4.3, 8.1, 8.2, 8.3_

- [x] 7. Add API functions to `web/src/api/groups.js`
  - Append `submitAdminRequest`, `voteOnAdminRequest`, `getAdminRequests`, `getMyAdminRequest` exports matching the design interface
  - _Requirements: 9.1, 9.4, 10.2, 10.4_

- [x] 8. Update `web/src/pages/GroupDetail.jsx` — member request button
  - Import `submitAdminRequest` and `getMyAdminRequest` from the API module
  - On page load, if `myMember?.role === 'member'`, fetch `getMyAdminRequest(id)` and store in state
  - Compute `capReached` from group data (admin count vs cap formula)
  - Render "Request Admin Role" button when cap not reached and no pending request; render disabled "Admin Request Pending" indicator when pending request exists
  - On button click call `submitAdminRequest`, update state without full reload
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 8.1 Write property test for UI button state (P11)
    - **Property 11: UI button state reflects request state**
    - Generate all combinations of `{ isAdmin, capReached, hasPending }` booleans; assert correct element is rendered using React Testing Library
    - **Validates: Requirements 9.1, 9.2, 9.3**

- [x] 9. Update `web/src/pages/GroupDetail.jsx` — admin requests section
  - Import `getAdminRequests` and `voteOnAdminRequest` from the API module
  - On page load, if `isAdmin`, fetch `getAdminRequests(id)` and store in state
  - Render "Admin Requests" section listing pending requests with requester name and date
  - Implement Approve button: call vote endpoint with `{ vote: 'approved' }`, refresh section
  - Implement Reject button: show inline reason input, call vote endpoint with `{ vote: 'rejected', rejection_reason }`, refresh section
  - Remove resolved requests from the pending list after vote
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use fast-check with a minimum of 100 iterations each
- Tag each property test: `// Feature: group-admin-requests, Property N: <property text>`
- The promotion in task 3 (unanimous approval) MUST use a single database transaction
- `computeAdminCap` should be exported from the controller so property tests can import it directly without hitting the database
