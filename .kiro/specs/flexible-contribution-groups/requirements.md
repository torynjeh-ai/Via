# Requirements Document

## Introduction

This feature introduces a new group type called a **Flexible Contribution Group**. Unlike the existing rotating savings (njangi) groups — which require every member to contribute a fixed amount each cycle and automatically disburse pooled funds to a rotating queue of recipients — a flexible contribution group has no fixed contribution amount. Members contribute any amount they choose at any time. The group admin controls all settings and decides how the pooled money is disbursed: to whom, when, and by what method. This group type is designed for community fundraising, shared expense pools, charity drives, and other use cases where free-form contributions and admin-controlled disbursements are more appropriate than a rigid rotating payout structure.

---

## Glossary

- **Flexible_Group**: A group of type `flexible`, where there is no fixed contribution amount and no automated payout queue.
- **Admin**: The member of a Flexible_Group who created it or was granted the admin role. The Admin controls all group settings and disbursement decisions.
- **Member**: A user who has been approved to participate in a Flexible_Group.
- **Contribution**: A voluntary monetary payment made by a Member into the Flexible_Group pool. The amount is chosen freely by the Member.
- **Pool**: The accumulated total of all completed Contributions held on behalf of a Flexible_Group.
- **Disbursement**: A transfer of funds from the Pool to one or more recipients, initiated and controlled exclusively by the Admin.
- **Disbursement_Method**: The mechanism used to send funds out of the Pool (e.g., TC wallet credit, mobile money transfer, manual/external).
- **Disbursement_Recipient**: The user or external party designated by the Admin to receive a Disbursement.
- **Group_Status**: The lifecycle state of a Flexible_Group. Valid values: `forming`, `active`, `completed`, `cancelled`.
- **TC_Wallet**: The in-app Trust Coin wallet used for payments and receipts within the platform.
- **Notification_Service**: The platform component responsible for sending push notifications to users.

---

## Requirements

### Requirement 1: Create a Flexible Contribution Group

**User Story:** As an Admin, I want to create a flexible contribution group with a name, description, optional member cap, and an optional fundraising goal, so that I can set up a pool for free-form contributions without specifying a fixed contribution amount.

#### Acceptance Criteria

1. WHEN a user submits a create-group request with `group_type` set to `flexible`, THE System SHALL create a new Flexible_Group record with status `forming` and store the provided name, description, max_members, visibility settings, and optional `goal_amount`.
2. THE System SHALL NOT require a `contribution_amount` field when `group_type` is `flexible`.
3. THE System SHALL NOT require a `cycle` field when `group_type` is `flexible`.
4. WHEN a Flexible_Group is created, THE System SHALL automatically add the creating user as an approved Admin member of that group.
5. IF a create-group request with `group_type` set to `flexible` omits the `name` field, THEN THE System SHALL return a 400 error with a descriptive message.
6. THE System SHALL store `group_type` on every group record so that the existing rotating savings group behaviour is preserved for groups of type `njangi`.
7. IF a `goal_amount` is provided, THE System SHALL validate that it is a positive number; otherwise THE System SHALL return a 400 error.
8. THE System SHALL allow `goal_amount` to be omitted (null) — groups without a goal are fully functional.

---

### Requirement 2: Manage Flexible Group Settings

**User Story:** As an Admin, I want to update the group name, description, member cap, and visibility at any time, so that I can keep the group information accurate as circumstances change.

#### Acceptance Criteria

1. WHEN an Admin submits an update-group request for a Flexible_Group, THE System SHALL update the `name`, `description`, `max_members`, and `visibility` fields with the provided values.
2. THE System SHALL allow the Admin to update `name`, `description`, and `visibility` regardless of the current Group_Status.
3. THE System SHALL allow the Admin to update `max_members` only when the Group_Status is `forming` or `active`.
4. IF an update request sets `max_members` to a value less than the current count of approved Members, THEN THE System SHALL return a 400 error with a descriptive message.
5. THE System SHALL NOT expose `contribution_amount` or `cycle` as editable fields on a Flexible_Group.

---

### Requirement 3: Member Joining and Approval

**User Story:** As a user, I want to request to join a flexible contribution group, and as an Admin, I want to approve or decline those requests, so that the group membership is controlled.

#### Acceptance Criteria

1. WHEN a user submits a join request for a Flexible_Group with Group_Status `forming` or `active`, THE System SHALL create a member record with status `pending` for that user.
2. IF a user submits a join request for a Flexible_Group and the user is already a Member of that group, THEN THE System SHALL return a 409 error.
3. WHEN an Admin approves a pending Member, THE System SHALL update the member status to `approved` and send a notification to the approved user via the Notification_Service.
4. WHEN an Admin declines a pending Member, THE System SHALL remove the member record and send a notification to the declined user via the Notification_Service.
5. WHEN a Flexible_Group has an invite token, THE System SHALL allow any authenticated user to join via the invite link, subject to Admin approval.

---

### Requirement 4: Activate a Flexible Group

**User Story:** As an Admin, I want to activate the group when I am ready to start accepting contributions, so that members can begin contributing to the pool.

#### Acceptance Criteria

1. WHEN an Admin submits an activate-group request for a Flexible_Group with Group_Status `forming`, THE System SHALL update the Group_Status to `active`, provided that at least 1 approved Member (other than the Admin) exists in the group.
2. IF an Admin submits an activate-group request for a Flexible_Group and no approved Members other than the Admin exist, THEN THE System SHALL return a 400 error with a descriptive message.
3. WHEN a Flexible_Group is activated, THE System SHALL send a notification to all currently approved Members via the Notification_Service.
4. THE System SHALL NOT generate a payout queue when activating a Flexible_Group.
5. WHEN a user submits a join request for a Flexible_Group with Group_Status `active`, THE System SHALL accept the request and create a member record with status `pending`, subject to Admin approval.

---

### Requirement 5: Make a Flexible Contribution

**User Story:** As a Member, I want to contribute any amount I choose to the group pool, so that I can participate in the group without being constrained to a fixed amount.

#### Acceptance Criteria

1. WHEN an approved Member submits a contribution request for an active Flexible_Group with a positive `amount` and a valid `payment_method`, THE System SHALL record a contribution with status `pending` and process the payment.
2. IF the payment succeeds, THEN THE System SHALL update the contribution status to `completed`, add the `amount` to the Pool balance, and send a notification to the Admin via the Notification_Service.
3. IF the payment fails, THEN THE System SHALL update the contribution status to `failed` and return a descriptive error message to the Member.
4. IF the `amount` is zero or negative, THEN THE System SHALL return a 400 error without creating a contribution record.
5. THE System SHALL NOT enforce a minimum or maximum contribution amount beyond the requirement that the amount is a positive number.
6. THE System SHALL NOT apply late-payment penalties to contributions in a Flexible_Group.
7. WHEN a Member submits a contribution, THE System SHALL accept `mtn_momo`, `orange_money`, and `tc_wallet` as valid payment methods.
8. THE System SHALL allow a Member to make multiple contributions to the same Flexible_Group within any time period.
9. THE System SHALL allow a newly approved Member to make contributions to a Flexible_Group regardless of whether the group was already active when the Member joined.

---

### Requirement 6: View Pool Balance and Contribution History

**User Story:** As a Member or Admin, I want to see the current pool balance and the history of all contributions, so that I can track how much has been collected and by whom.

#### Acceptance Criteria

1. WHEN an approved Member or Admin requests the pool summary for an active Flexible_Group, THE System SHALL return the total Pool balance (sum of all completed contributions) and the count of contributing Members.
2. THE System SHALL NOT include individual Member contribution amounts in the pool summary response returned to Members; only the Admin SHALL receive a breakdown of contributions per Member.
3. WHEN an Admin requests the contribution history for a Flexible_Group, THE System SHALL return a list of all contribution records ordered by date descending, including contributor name, amount, payment method, and status.
4. WHEN an approved Member (non-Admin) requests the contribution history for a Flexible_Group, THE System SHALL return a list of all contribution records ordered by date descending, including payment method, status, and timestamp, but SHALL omit the individual contributor name and amount from each record.
5. THE System SHALL include only contributions with status `completed` in the Pool balance calculation.
6. IF a non-member requests the pool summary or contribution history, THEN THE System SHALL return a 403 error.

---

### Requirement 7: Admin Initiates a Disbursement

**User Story:** As an Admin, I want to record a disbursement from the pool to a specified recipient, so that I can track how the collected funds have been distributed according to the group's purpose.

#### Acceptance Criteria

1. WHEN an Admin submits a disbursement request for an active Flexible_Group with a valid `amount`, `recipient_id` or `recipient_description`, and `disbursement_method`, THE System SHALL create a disbursement record with status `pending`.
2. IF the requested disbursement `amount` exceeds the current Pool balance, THEN THE System SHALL return a 400 error with the current Pool balance in the response.
3. WHEN a disbursement is created, THE System SHALL deduct the `amount` from the Pool balance and update the disbursement status to `completed`. No automated payment of any kind SHALL be initiated by the System, regardless of the `disbursement_method` specified.
4. THE System SHALL record the disbursement as `completed` immediately for all `disbursement_method` values (`tc_wallet`, `mtn_momo`, `orange_money`, `bank_transfer`, `manual`). The Admin is solely responsible for executing the actual money movement externally.
5. WHEN a disbursement is completed, THE System SHALL send a notification to all approved Members via the Notification_Service describing the disbursement amount and recipient.
6. THE System SHALL record the Admin's user ID, timestamp, amount, recipient, and method on every disbursement record.

---

### Requirement 8: View Disbursement History

**User Story:** As a Member or Admin, I want to see the history of all disbursements made from the pool, so that I can verify how the funds have been used.

#### Acceptance Criteria

1. WHEN an approved Member or Admin requests the disbursement history for a Flexible_Group, THE System SHALL return a list of all disbursement records ordered by date descending, including amount, recipient description, disbursement method, status, and timestamp.
2. THE System SHALL include the Admin's name on each disbursement record in the response.
3. IF a non-member requests the disbursement history, THEN THE System SHALL return a 403 error.

---

### Requirement 9: Close a Flexible Group

**User Story:** As an Admin, I want to close the group when its purpose is fulfilled, so that no further contributions or disbursements can be made.

#### Acceptance Criteria

1. WHEN an Admin submits a close-group request for a Flexible_Group with Group_Status `active`, THE System SHALL update the Group_Status to `completed`.
2. WHEN a Flexible_Group is closed, THE System SHALL send a notification to all approved Members via the Notification_Service.
3. IF the Pool balance is greater than zero at the time of closing, THEN THE System SHALL include the remaining Pool balance in the close-group response and in the notification to Members.
4. WHILE the Group_Status is `completed`, THE System SHALL reject any new contribution or disbursement requests with a 400 error.

---

### Requirement 10: Distinguish Flexible Groups in Listings

**User Story:** As a user browsing groups, I want to clearly see which groups are flexible contribution groups and which are rotating savings groups, so that I can choose the right type to join.

#### Acceptance Criteria

1. WHEN the System returns a list of groups, THE System SHALL include the `group_type` field (`flexible` or `njangi`) on every group record.
2. THE System SHALL apply the same visibility filtering rules (public, private, region) to Flexible_Groups as it does to njangi groups.
3. THE System SHALL NOT display a `contribution_amount` or `cycle` for Flexible_Groups in the group listing or detail responses.

---

### Requirement 11: Display Goal Progress

**User Story:** As a Member or Admin, I want to see how close the group is to its fundraising goal, so that I can understand the group's progress at a glance.

#### Acceptance Criteria

1. WHEN a Flexible_Group has a `goal_amount` set and an approved Member or Admin requests the pool summary, THE System SHALL include a `goal_percent` field calculated as `FLOOR(pool_balance / goal_amount * 100)`, capped at a maximum of 100.
2. WHEN a Flexible_Group has no `goal_amount` set (null), THE System SHALL return `goal_percent` as `null` in the pool summary response.
3. THE System SHALL also include the `goal_amount` value (or null) in the pool summary response so the frontend can render a progress bar.
4. WHEN an Admin updates a Flexible_Group and provides a new `goal_amount`, THE System SHALL update the stored value and the next pool summary response SHALL reflect the new `goal_percent`.
5. THE System SHALL allow the Admin to set `goal_amount` to `null` (removing the goal) via an update request.
6. IF an update request sets `goal_amount` to a non-positive number, THE System SHALL return a 400 error.

---

### Requirement 12: Delete a Flexible Group

**User Story:** As an Admin, I want to permanently delete a flexible group after it has served its purpose, so that the group no longer appears in listings and all associated data is cleaned up.

#### Acceptance Criteria

1. WHEN an Admin submits a delete request for a Flexible_Group and at least one `flexible_disbursements` record exists for that group, THE System SHALL proceed with deletion.
2. IF an Admin submits a delete request for a Flexible_Group and no disbursement records exist, THE System SHALL return a 400 error with a descriptive message indicating the group cannot be deleted until at least one disbursement has been recorded.
3. BEFORE deleting the group, THE System SHALL send a final notification to all currently approved Members via the Notification_Service informing them that the group has been deleted.
4. THE System SHALL hard-delete the group record and all associated records (members, flexible_contributions, flexible_disbursements) via cascading deletes.
5. AFTER deletion, any request referencing the deleted group's ID SHALL return a 404 error.
6. THE System SHALL require explicit Admin confirmation (a `confirm: true` flag in the request body) before proceeding with deletion; if the flag is absent or false, THE System SHALL return a 400 error.
