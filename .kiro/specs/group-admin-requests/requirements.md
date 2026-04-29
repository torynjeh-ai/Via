# Requirements Document

## Introduction

The Group Admin Request System allows approved members of a NjangiPay group to request elevation to admin role. Requests are routed to all existing admins, who must unanimously approve for the role upgrade to take effect. A single rejection immediately denies the request. The system enforces a dynamic admin cap (1 admin per 10 members, rounded down) and notifies all relevant parties at each stage.

## Glossary

- **System**: The NjangiPay backend and web application.
- **Group**: A savings circle managed within NjangiPay.
- **Member**: A user with `status = 'approved'` and `role = 'member'` in a Group.
- **Admin**: A user with `status = 'approved'` and `role = 'admin'` in a Group.
- **Creator**: The user who created the Group; always the first Admin.
- **Admin_Cap**: The maximum number of Admins allowed in a Group, calculated as `FLOOR(approved_member_count / 10) * 3`, minimum 1 (e.g. 10 members → 3 admins, 20 members → 6 admins).
- **Admin_Request**: A record in the `admin_requests` table representing a Member's request to become an Admin.
- **Admin_Vote**: A record in the `admin_request_votes` table representing one Admin's approve or reject decision on an Admin_Request.
- **Notification_Service**: The backend service responsible for persisting and pushing notifications to users.

---

## Requirements

### Requirement 1: Admin Cap Enforcement

**User Story:** As a group creator, I want the number of admins to scale with group size, so that governance remains proportional.

#### Acceptance Criteria

1. THE System SHALL calculate the Admin_Cap for a Group as `FLOOR(approved_member_count / 10) * 3`, with a minimum value of 1 (e.g. 10 members → max 3 admins, 20 members → max 6 admins).
2. WHEN a Member submits an Admin_Request, IF the current number of Admins in the Group equals or exceeds the Admin_Cap, THEN THE System SHALL reject the request with an HTTP 409 status and the message "Admin cap reached for this group size".
3. WHEN the number of approved Members in a Group changes, THE System SHALL recalculate the Admin_Cap dynamically on each Admin_Request submission.

---

### Requirement 2: Submitting an Admin Request

**User Story:** As an approved group member, I want to request the admin role, so that I can help manage the group.

#### Acceptance Criteria

1. WHEN an authenticated user submits a POST to `/groups/:groupId/admin-requests`, THE System SHALL verify the user has `status = 'approved'` and `role = 'member'` in the Group, and IF not, SHALL return HTTP 403.
2. WHEN a Member submits an Admin_Request and the Admin_Cap has not been reached, THE System SHALL insert a row into `admin_requests` with `status = 'pending'` and return HTTP 201.
3. IF a Member already has a pending Admin_Request for the same Group, THEN THE System SHALL return HTTP 409 with the message "A pending request already exists".
4. WHEN a new Admin_Request is created, THE System SHALL insert one Admin_Vote row per existing Admin with `vote = NULL` (awaiting decision).
5. WHEN a new Admin_Request is created, THE Notification_Service SHALL send a notification of type `admin_request_new` to every Admin in the Group.

---

### Requirement 3: Single-Admin Routing

**User Story:** As the sole group admin (creator), I want to be the only approver when I am the only admin, so that requests are not blocked waiting for non-existent co-admins.

#### Acceptance Criteria

1. WHEN a new Admin_Request is created and the Group has exactly 1 Admin, THE System SHALL create exactly 1 Admin_Vote row for that Admin.
2. WHEN that Admin approves the Admin_Vote, THE System SHALL immediately upgrade the Member's role to `admin` and mark the Admin_Request `status = 'approved'`.

---

### Requirement 4: Multi-Admin Routing

**User Story:** As a group with multiple admins, I want all admins to have a say in approving new admins, so that no single admin can unilaterally grant elevated privileges.

#### Acceptance Criteria

1. WHEN a new Admin_Request is created and the Group has 2 or more Admins, THE System SHALL create one Admin_Vote row per Admin.
2. WHEN an Admin submits an approval vote and all other Admin_Votes for the same Admin_Request already have `vote = 'approved'`, THE System SHALL upgrade the requesting Member's role to `admin` and mark the Admin_Request `status = 'approved'`.
3. WHILE an Admin_Request has `status = 'pending'`, THE System SHALL allow any Admin who has not yet voted to submit a vote.

---

### Requirement 5: Rejection Logic

**User Story:** As an admin, I want to be able to reject an admin request immediately, so that unqualified members cannot become admins.

#### Acceptance Criteria

1. WHEN an Admin submits a rejection vote on a pending Admin_Request, THE System SHALL immediately set the Admin_Request `status = 'rejected'` and record the optional `rejection_reason` on the Admin_Vote row.
2. WHEN an Admin_Request is rejected, THE Notification_Service SHALL send a notification of type `admin_request_rejected` to the requesting Member, including the rejection reason if provided.
3. WHEN an Admin_Request is rejected, THE Notification_Service SHALL send a notification of type `admin_request_rejected_peer` to all other Admins in the Group, including the name of the rejecting Admin and the rejection reason if provided.
4. IF an Admin attempts to vote on an Admin_Request that already has `status != 'pending'`, THEN THE System SHALL return HTTP 409 with the message "Request is no longer pending".

---

### Requirement 6: Approval Logic

**User Story:** As a requesting member, I want to be notified and granted admin privileges once all admins approve, so that I can start managing the group.

#### Acceptance Criteria

1. WHEN all Admin_Votes for an Admin_Request have `vote = 'approved'`, THE System SHALL update the Member's `role` to `admin` in the `members` table within the same database transaction as marking the Admin_Request `status = 'approved'`.
2. WHEN an Admin_Request reaches `status = 'approved'`, THE Notification_Service SHALL send a notification of type `admin_request_approved` to the requesting Member.

---

### Requirement 7: Notifications

**User Story:** As a group participant, I want timely notifications about admin request activity, so that I can act or stay informed.

#### Acceptance Criteria

1. WHEN a new Admin_Request is created, THE Notification_Service SHALL notify all Admins with title "New Admin Request" and a message identifying the requesting Member's name.
2. WHEN an Admin_Request is approved, THE Notification_Service SHALL notify the requesting Member with title "Admin Request Approved" and message "You have been granted admin privileges in [group name]".
3. WHEN an Admin_Request is rejected, THE Notification_Service SHALL notify the requesting Member with title "Admin Request Denied" and message including the rejection reason if one was provided.
4. WHEN an Admin_Request is rejected, THE Notification_Service SHALL notify all other Admins with title "Admin Request Rejected" and message identifying the rejecting Admin's name and the rejection reason if provided.
5. THE Notification_Service SHALL persist all notifications to the `notifications` table before attempting push delivery.

---

### Requirement 8: Admin Requests API — Read Endpoints

**User Story:** As an admin or member, I want to view pending admin requests for my group, so that I can take action or track my own request.

#### Acceptance Criteria

1. WHEN an authenticated Admin sends GET `/groups/:groupId/admin-requests`, THE System SHALL return all Admin_Requests for the Group with their current status, requester name, and per-admin vote summary.
2. WHEN an authenticated Member (non-admin) sends GET `/groups/:groupId/admin-requests/my`, THE System SHALL return that Member's own Admin_Request for the Group if one exists, or an empty result if none.
3. IF a user who is not a Member of the Group requests admin request data, THEN THE System SHALL return HTTP 403.

---

### Requirement 9: UI — Member Eligibility and Request Button

**User Story:** As an eligible group member, I want to see a "Request Admin Role" button on the group detail page, so that I can initiate the process.

#### Acceptance Criteria

1. WHEN the GroupDetail page loads and the current user is an approved Member with `role = 'member'`, THE System SHALL display a "Request Admin Role" button if the Admin_Cap has not been reached and the Member has no pending Admin_Request.
2. WHEN the Member has a pending Admin_Request, THE System SHALL display a disabled status indicator "Admin Request Pending" instead of the button.
3. WHEN the Admin_Cap has been reached, THE System SHALL not display the "Request Admin Role" button for any Member.
4. WHEN a Member clicks "Request Admin Role" and the submission succeeds, THE System SHALL update the UI to show the "Admin Request Pending" indicator without a full page reload.

---

### Requirement 10: UI — Admin Requests Section

**User Story:** As a group admin, I want a dedicated section on the group detail page showing pending admin requests with approve/reject controls, so that I can act on them efficiently.

#### Acceptance Criteria

1. WHEN the GroupDetail page loads and the current user is an Admin, THE System SHALL display an "Admin Requests" section listing all pending Admin_Requests with the requester's name and request date.
2. WHEN an Admin clicks "Approve" on a pending Admin_Request, THE System SHALL call the vote endpoint and refresh the Admin_Requests section.
3. WHEN an Admin clicks "Reject" on a pending Admin_Request, THE System SHALL display an optional text input for a rejection reason before submitting the vote.
4. WHEN a rejection is submitted, THE System SHALL call the vote endpoint with the optional reason and refresh the Admin_Requests section.
5. WHEN an Admin_Request transitions to `status = 'approved'` or `status = 'rejected'`, THE System SHALL remove it from the pending list in the UI.

---

### Requirement 11: Database Schema

**User Story:** As a backend developer, I want a well-structured schema for admin requests and votes, so that the system can track state reliably.

#### Acceptance Criteria

1. THE System SHALL maintain an `admin_requests` table with columns: `id` (UUID PK), `group_id` (FK → groups), `requester_id` (FK → users), `status` (enum: `pending`, `approved`, `rejected`), `created_at`, `updated_at`.
2. THE System SHALL maintain an `admin_request_votes` table with columns: `id` (UUID PK), `request_id` (FK → admin_requests), `admin_id` (FK → users), `vote` (enum: `approved`, `rejected`, nullable), `rejection_reason` (TEXT nullable), `voted_at` (TIMESTAMP nullable).
3. THE System SHALL enforce a UNIQUE constraint on `(group_id, requester_id)` in `admin_requests` to prevent duplicate pending requests per member per group.
4. THE System SHALL enforce a UNIQUE constraint on `(request_id, admin_id)` in `admin_request_votes`.
5. THE System SHALL add indexes on `admin_requests(group_id)`, `admin_requests(requester_id)`, and `admin_request_votes(request_id)`.
