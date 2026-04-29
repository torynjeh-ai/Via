# Requirements Document

## Introduction

Trust Coin (TC) is Via's in-app currency that replaces the legacy `trust_score` field. Users fund a TC wallet with real money and use it for all in-app financial transactions — group contributions, receiving payouts, and peer-to-peer transfers — eliminating repeated external payment steps. The exchange rate is fixed at 1 TC = 10,000 XAF. Balances are displayed to two decimal places. Each user receives a unique wallet code (e.g. `VIA-X7K2P`) on first wallet activation, which can be used as an alternative to a phone number when receiving transfers.

## Glossary

- **TC (Trust Coin)**: Via's in-app currency. 1 TC = 10,000 XAF.
- **Wallet**: The per-user TC balance account managed by the system.
- **Wallet_Code**: A unique, short alphanumeric identifier (format `VIA-XXXXX`) assigned to each user's wallet on first activation.
- **Top-up**: The act of funding a wallet by converting real money into TC via an external payment method.
- **Withdrawal**: The act of converting TC back to real money and sending it to an external account.
- **Contribution**: A scheduled payment made by a group member into a savings group cycle.
- **Payout**: A disbursement of pooled group funds to a designated member.
- **Transfer**: A peer-to-peer TC send from one user's wallet to another.
- **Fee**: A percentage charge applied to certain transfer types.
- **Exchange_Rate_Service**: An external API providing live fiat currency exchange rates.
- **Payment_Service**: The existing service handling MTN MoMo and Orange Money transactions.
- **Wallet_Service**: The new backend service responsible for all TC wallet operations.
- **XAF**: Central African CFA franc — the base fiat currency for TC conversion.

---

## Requirements

### Requirement 1: Wallet Initialisation and Balance

**User Story:** As a Via user, I want a TC wallet automatically created for me, so that I can start using in-app currency without manual setup.

#### Acceptance Criteria

1. WHEN a new user account is created, THE Wallet_Service SHALL initialise a wallet for that user with a TC balance of 0.00.
2. THE Wallet_Service SHALL store TC balances as a decimal value with a precision of at least 8 significant digits and display them rounded to 2 decimal places (e.g. 0.05 TC, 1.25 TC).
3. WHEN a user's wallet is accessed for the first time, THE Wallet_Service SHALL generate a unique Wallet_Code in the format `VIA-XXXXX` (where X is an uppercase alphanumeric character) and persist it to the user's record.
4. THE Wallet_Service SHALL guarantee that no two users share the same Wallet_Code.
5. WHEN a user views their wallet screen, THE Wallet_Service SHALL display the Wallet_Code alongside a copy-to-clipboard control.
6. THE Wallet_Service SHALL replace the legacy `trust_score` field with a `tc_balance` column in the `users` table; the old `trust_score` column SHALL be removed from all API responses.

---

### Requirement 2: Wallet Top-up

**User Story:** As a Via user, I want to fund my TC wallet using real money, so that I can pay for group contributions and transfers without leaving the app.

#### Acceptance Criteria

1. WHEN a user initiates a top-up, THE Wallet_Service SHALL accept a fiat amount in XAF and a payment method of: `mtn_momo`, `orange_money`, `bank_transfer`, or `card`.
2. WHEN a top-up payment is confirmed as successful by the Payment_Service, THE Wallet_Service SHALL credit the user's wallet with the equivalent TC amount calculated as `XAF_amount / 100 / 100` (i.e. 100 XAF = 0.01 TC).
3. IF a top-up payment fails or is rejected by the Payment_Service, THEN THE Wallet_Service SHALL leave the user's TC balance unchanged and return a descriptive error.
4. WHEN a top-up is completed, THE Wallet_Service SHALL record a transaction entry with: type `top_up`, TC amount credited, fiat amount paid, payment method, external transaction ID, timestamp, and status.
5. THE Wallet_Service SHALL reject top-up requests where the XAF amount is less than 100 XAF (the minimum unit of 0.01 TC).

---

### Requirement 3: Wallet Withdrawal

**User Story:** As a Via user, I want to withdraw TC from my wallet as real money, so that I can access my savings when needed.

#### Acceptance Criteria

1. WHEN a user initiates a withdrawal, THE Wallet_Service SHALL accept a TC amount and a destination of: `mtn_momo` (with phone number), `orange_money` (with phone number), `bank_account` (with account details), or `card` (with card details).
2. WHEN a withdrawal is requested, THE Wallet_Service SHALL verify that the user's TC balance is greater than or equal to the requested TC amount before processing.
3. IF the user's TC balance is less than the requested withdrawal amount, THEN THE Wallet_Service SHALL reject the request and return an insufficient-balance error without modifying the balance.
4. WHEN a withdrawal is approved, THE Wallet_Service SHALL deduct the TC amount from the user's balance and initiate a fiat disbursement of `TC_amount × 10,000` XAF to the specified destination.
5. IF the disbursement to the external destination fails, THEN THE Wallet_Service SHALL reverse the TC deduction and restore the user's balance to its pre-withdrawal value.
6. WHEN a withdrawal is completed, THE Wallet_Service SHALL record a transaction entry with: type `withdrawal`, TC amount debited, fiat amount disbursed, destination method, external transaction ID, timestamp, and status.
7. THE Wallet_Service SHALL reject withdrawal requests where the TC amount is less than 0.01 TC.
8. THE Wallet_Service SHALL support the same set of withdrawal destinations as deposit methods — MTN MoMo, Orange Money, bank transfer, and card — ensuring symmetry between funding and cashout options.

---

### Requirement 4: Pay Group Contributions via Wallet

**User Story:** As a group member, I want to pay my group contribution directly from my TC wallet, so that I don't need to use an external payment method each cycle.

#### Acceptance Criteria

1. WHEN a user selects `tc_wallet` as the payment method for a contribution, THE Wallet_Service SHALL verify that the user's TC balance is greater than or equal to the contribution amount expressed in TC.
2. IF the user's TC balance is insufficient for the contribution, THEN THE Wallet_Service SHALL reject the contribution and return an insufficient-balance error.
3. WHEN a wallet-funded contribution is processed, THE Wallet_Service SHALL atomically deduct the TC amount from the user's balance and mark the contribution as `completed`.
4. WHEN a wallet-funded contribution is completed, THE Wallet_Service SHALL record a transaction entry with: type `contribution`, TC amount debited, group ID, cycle number, and timestamp.
5. THE Wallet_Service SHALL apply no fee to wallet-funded contributions.

---

### Requirement 5: Receive Group Payouts into Wallet

**User Story:** As a group member, I want group payouts to be deposited directly into my TC wallet, so that I can use the funds immediately within the app.

#### Acceptance Criteria

1. WHEN a group payout is disbursed to a member, THE Wallet_Service SHALL credit the member's TC wallet with the payout amount converted to TC at the rate of `XAF_amount / 10,000`.
2. WHEN a payout is credited, THE Wallet_Service SHALL record a transaction entry with: type `payout`, TC amount credited, group ID, payout ID, and timestamp.
3. THE Wallet_Service SHALL apply no fee to payout credits.
4. WHEN a payout is credited to a user's wallet, THE Wallet_Service SHALL send the user a notification confirming the TC amount received.

---

### Requirement 6: Peer-to-Peer TC Transfer

**User Story:** As a Via user, I want to send TC to another user by phone number or wallet code, so that I can pay people directly within the app.

#### Acceptance Criteria

1. WHEN a user initiates a transfer, THE Wallet_Service SHALL accept a recipient identifier that is either a registered phone number or a valid Wallet_Code.
2. IF the recipient identifier does not match any active Via user, THEN THE Wallet_Service SHALL reject the transfer and return a recipient-not-found error.
3. WHEN a transfer is initiated, THE Wallet_Service SHALL verify that the sender's TC balance is greater than or equal to the transfer amount plus any applicable fee.
4. IF the sender's balance is insufficient to cover the transfer amount plus fee, THEN THE Wallet_Service SHALL reject the transfer and return an insufficient-balance error.
5. WHEN the sender and recipient are both members of at least one common active group, THE Wallet_Service SHALL apply a fee of 0.00 TC to the transfer.
6. WHEN the sender and recipient share no common active group, THE Wallet_Service SHALL apply a fee of 0.5% of the transfer amount, rounded up to the nearest 0.01 TC.
7. WHEN a transfer is executed, THE Wallet_Service SHALL atomically deduct `transfer_amount + fee` from the sender's balance and credit `transfer_amount` to the recipient's balance.
8. WHEN a transfer is completed, THE Wallet_Service SHALL record a transaction entry for the sender with: type `transfer_out`, TC amount debited, fee charged, recipient user ID, and timestamp.
9. WHEN a transfer is completed, THE Wallet_Service SHALL record a transaction entry for the recipient with: type `transfer_in`, TC amount credited, sender user ID, and timestamp.
10. WHEN a transfer is completed, THE Wallet_Service SHALL send a notification to the recipient confirming the TC amount received and the sender's name.

---

### Requirement 7: Transfer Confirmation Screen

**User Story:** As a Via user, I want to see a full breakdown before confirming a transfer, so that I understand exactly what will be sent and what fees apply.

#### Acceptance Criteria

1. WHEN a user reviews a pending transfer, THE Wallet_Service SHALL provide an endpoint returning: TC amount to send, fee in TC, total TC to be deducted from sender, TC amount recipient will receive, and the real-money equivalent of each TC value in the user's preferred display currency and XAF.
2. THE Wallet_Service SHALL support real-money equivalents in the following currencies: XAF, USD, EUR, GBP, NGN, GHS, KES.
3. WHEN the confirmation data is requested, THE Wallet_Service SHALL fetch live exchange rates from the Exchange_Rate_Service and apply them to compute fiat equivalents.
4. IF the Exchange_Rate_Service is unavailable, THEN THE Wallet_Service SHALL return the confirmation data with fiat equivalents marked as unavailable rather than blocking the transfer.
5. THE Wallet_Service SHALL display the user's preferred currency prominently on the confirmation screen, with other supported currencies available as secondary information.
6. WHEN a user has not set a preferred display currency, THE Wallet_Service SHALL default to XAF.

---

### Requirement 8: Currency Conversion Display

**User Story:** As a Via user, I want to see my TC balance and transfer amounts in multiple real-world currencies, so that I always know the real value of my funds.

#### Acceptance Criteria

1. WHEN a user views their wallet screen, THE Wallet_Service SHALL display the TC balance alongside its real-money equivalent in at least XAF and the user's preferred display currency.
2. THE Wallet_Service SHALL support conversion display for: XAF, USD, EUR, GBP, NGN, GHS, KES.
3. WHEN currency conversion is displayed, THE Wallet_Service SHALL use live exchange rates fetched from the Exchange_Rate_Service, with a cache TTL of no more than 60 minutes.
4. IF the Exchange_Rate_Service is unavailable or returns an error, THEN THE Wallet_Service SHALL display the last successfully cached rate with a visible staleness indicator, rather than showing no conversion.
5. THE Wallet_Service SHALL always display XAF conversion using the fixed internal rate of 1 TC = 10,000 XAF, independent of the Exchange_Rate_Service.

---

### Requirement 9: Transaction History

**User Story:** As a Via user, I want to view a history of all my wallet transactions, so that I can track my spending and earnings.

#### Acceptance Criteria

1. WHEN a user requests their transaction history, THE Wallet_Service SHALL return a paginated list of all wallet transactions for that user, ordered by timestamp descending.
2. THE Wallet_Service SHALL include the following fields for each transaction: transaction ID, type (`top_up`, `withdrawal`, `contribution`, `payout`, `transfer_in`, `transfer_out`), TC amount, fiat equivalent in XAF, counterparty name or description, status, and timestamp.
3. WHEN a user filters transaction history by type, THE Wallet_Service SHALL return only transactions matching the specified type.
4. THE Wallet_Service SHALL return a maximum of 50 transactions per page and SHALL include a cursor or offset for pagination.

---

### Requirement 10: Wallet Security and Atomicity

**User Story:** As a Via user, I want my wallet balance to always be accurate and protected from race conditions, so that I never lose funds due to system errors.

#### Acceptance Criteria

1. THE Wallet_Service SHALL perform all balance-modifying operations (top-up, withdrawal, contribution, payout, transfer) within a database transaction to ensure atomicity.
2. IF any step within a balance-modifying operation fails, THEN THE Wallet_Service SHALL roll back all changes within that operation and leave all balances unchanged.
3. THE Wallet_Service SHALL use database-level row locking (e.g. `SELECT ... FOR UPDATE`) when reading a balance prior to a debit operation to prevent concurrent overdrafts.
4. THE Wallet_Service SHALL reject any operation that would result in a negative TC balance.
5. WHEN an authenticated user requests wallet data or initiates a wallet operation, THE Wallet_Service SHALL verify that the requesting user's identity matches the wallet owner before processing.

---

### Requirement 11: Withdrawal and Transfer Limits

**User Story:** As a platform operator, I want withdrawal and transfer limits enforced per user, so that the system is protected from abuse and complies with financial regulations.

#### Acceptance Criteria

1. THE Wallet_Service SHALL require users to have completed identity verification (`profile_complete = true`) before allowing any withdrawal or outgoing transfer operations.

2. IF a user with `profile_complete = false` attempts a withdrawal or transfer, THEN THE Wallet_Service SHALL reject the request with a `PROFILE_INCOMPLETE` error.

3. THE Wallet_Service SHALL enforce the following limits for **all verified users**:
   - Single transaction maximum: 200 TC (2,000,000 XAF)
   - Daily withdrawal/transfer limit: 500 TC (5,000,000 XAF)
   - Monthly withdrawal/transfer limit: 2,000 TC (20,000,000 XAF)

4. WHEN a withdrawal or transfer is requested, THE Wallet_Service SHALL calculate the user's total withdrawals and outgoing transfers for the current calendar day (UTC) and calendar month (UTC) before processing.

5. IF a requested withdrawal or transfer would cause the user's daily or monthly total to exceed the applicable limit, THEN THE Wallet_Service SHALL reject the request with a descriptive error indicating which limit would be exceeded and when it resets.

6. IF a single withdrawal or transfer amount exceeds 200 TC, THEN THE Wallet_Service SHALL reject the request immediately without checking rolling totals.

7. THE Wallet_Service SHALL apply withdrawal limits to both withdrawals and outgoing peer-to-peer transfers when calculating rolling totals.

8. WHEN a user's limit check fails, THE Wallet_Service SHALL include in the error response: the limit that was exceeded, the current rolling total, the limit value, and the reset time (midnight UTC for daily, first of next month for monthly).

9. THE Wallet_Service SHALL allow unverified users to top up their wallet and receive incoming transfers or payouts, but SHALL block all debit operations until identity verification is complete.
