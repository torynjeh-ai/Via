# Implementation Plan: Trust Coin Wallet

## Overview

Implement the Trust Coin (TC) in-app currency system end-to-end: database migration, backend services and routes, updates to existing controllers/services, web frontend pages and components, mobile frontend screens and navigation, and property-based + integration tests. Each task builds on the previous so that no code is left orphaned.

## Tasks

- [x] 1. Database migration — rename trust_score and add wallet tables
  - Create `backend/migrations/add_trust_coin_wallet.sql`
  - Rename `trust_score` → `tc_balance`, change type to `DECIMAL(18,8)`, set default `0.00000000`
  - Add `wallet_code VARCHAR(10) UNIQUE` and `preferred_currency VARCHAR(3) DEFAULT 'XAF'` columns to `users`
  - Create `wallet_transactions` table with all columns, constraints, and indexes as specified in the design
  - _Requirements: 1.2, 1.6, 9.1, 9.4, 10.1_

- [ ] 2. ExchangeRateService
  - [x] 2.1 Implement `backend/src/services/exchangeRateService.js`
    - Implement `getRates()`: fetch live rates from external Exchange Rate API for USD, EUR, GBP, NGN, GHS, KES; always compute XAF from the fixed 10,000 constant; cache result in a module-level `Map` with a `fetchedAt` timestamp
    - Implement `convertTC(tcAmount)`: multiply `tcAmount × 10000` for XAF; apply live rates for other currencies; return `{ XAF, USD, EUR, GBP, NGN, GHS, KES, stale: bool }`
    - On API failure return last cached rates with `stale: true`; if no cache exists yet, return XAF-only with `stale: true`
    - _Requirements: 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 2.2 Write property test for currency conversion consistency (Property 9)
    - **Property 9: Currency conversion consistency**
    - Generate arbitrary TC amounts; assert `convertTC(amount).XAF === amount * 10000` regardless of mock exchange rate state
    - **Validates: Requirements 8.5**

  - [ ]* 2.3 Write property test for exchange rate cache TTL (Property 11)
    - **Property 11: Exchange rate cache TTL**
    - Mock `Date.now()`; assert no external HTTP call is made within 60 minutes of last successful fetch; assert a fresh call is made after 60 minutes
    - **Validates: Requirements 8.3**

  - [ ]* 2.4 Write property test for exchange rate resilience (Property 12)
    - **Property 12: Exchange rate resilience**
    - Mock the external API to throw; assert `getRates()` returns last cached rates with `stale: true` and does not throw
    - **Validates: Requirements 7.4, 8.4**

- [ ] 3. WalletService — core balance operations
  - [x] 3.1 Implement `backend/src/services/walletService.js` — scaffold and `initWallet`
    - Create the file; import `pool` from `../config/database`, `processPayment` from `paymentService`, `sendNotificationToUser` from `notificationService`, `exchangeRateService`
    - Implement `initWallet(userId, client?)`: insert `tc_balance = 0` for the user (or no-op if already exists); accept an optional DB client for use inside the registration transaction
    - _Requirements: 1.1_

  - [x] 3.2 Implement `getWallet` and `activateWalletCode`
    - `getWallet(userId)`: SELECT `tc_balance`, `wallet_code`, `preferred_currency` from `users`; if `wallet_code` is NULL call `activateWalletCode` first
    - `activateWalletCode(userId)`: generate `VIA-` + 5 uppercase alphanumeric chars using `crypto.randomBytes`; retry up to 5 times on unique-constraint violation; UPDATE `users SET wallet_code = $1 WHERE id = $2`; return the code
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ]* 3.3 Write property test for wallet code uniqueness (Property 7)
    - **Property 7: Wallet code uniqueness**
    - Generate N concurrent `activateWalletCode` calls against a mock DB; assert all returned codes are distinct and each matches `/^VIA-[A-Z0-9]{5}$/`
    - **Validates: Requirements 1.3, 1.4**

  - [x] 3.4 Implement `checkLimits`
    - `checkLimits({ userId, tcAmount, isVerified })`: verify `profile_complete = true`; reject single tx > 200 TC; query rolling daily and monthly totals of `withdrawal` + `transfer_out` transactions; return `{ allowed, reason?, limitType?, currentTotal?, limit?, resetsAt? }`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [x] 3.5 Implement `topUp`
    - `topUp({ userId, xafAmount, paymentMethod, phone })`: reject if `xafAmount < 100`; call `processPayment`; on success open a DB transaction, `UPDATE users SET tc_balance = tc_balance + $tcAmount WHERE id = $userId`, insert `wallet_transactions` row with type `top_up`; on payment failure leave balance unchanged
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 10.1, 10.2_

  - [ ]* 3.6 Write property test for top-up credit round-trip (Property 2)
    - **Property 2: Top-up credit round-trip**
    - Generate arbitrary XAF amounts ≥ 100; mock `processPayment` to succeed; assert `tc_balance` delta equals `xafAmount / 10000` and a `top_up` transaction record exists with that exact `tc_amount`
    - **Validates: Requirements 2.2, 2.4**

  - [x] 3.7 Implement `withdraw`
    - `withdraw({ userId, tcAmount, destination })`: reject if `tcAmount < 0.01`; call `checkLimits`; open DB transaction; `SELECT tc_balance FROM users WHERE id = $userId FOR UPDATE`; reject if balance < `tcAmount`; deduct balance; insert `withdrawal` transaction with status `pending`; call `processPayment` for disbursement; on success update transaction to `completed`; on failure insert compensating credit transaction, restore balance, update original to `reversed` — all within the same DB transaction
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 10.1, 10.2, 10.3, 10.4_

  - [ ]* 3.8 Write property test for withdrawal debit round-trip (Property 3)
    - **Property 3: Withdrawal debit round-trip**
    - Generate arbitrary TC amounts ≤ current balance; mock disbursement to succeed; assert `tc_balance` delta equals `-tcAmount` and a `withdrawal` transaction record exists
    - **Validates: Requirements 3.4, 3.6**

  - [ ]* 3.9 Write property test for withdrawal reversal restores balance (Property 4)
    - **Property 4: Withdrawal reversal restores balance**
    - Mock disbursement to fail; assert `tc_balance` after the call equals the balance before the call
    - **Validates: Requirements 3.5, 10.2**

  - [ ]* 3.10 Write property test for balance non-negativity invariant (Property 1)
    - **Property 1: Balance non-negativity invariant**
    - Generate arbitrary sequences of top-up, withdrawal, contribution, and transfer operations (valid and invalid); assert `tc_balance >= 0` after every step
    - **Validates: Requirements 3.4, 4.2, 6.4, 10.4**

  - [ ]* 3.11 Write property test for insufficient balance rejection (Property 10)
    - **Property 10: Insufficient balance rejection**
    - Generate TC amounts > current balance for withdrawal, contribution, and transfer; assert each is rejected, balance is unchanged, and no transaction record is inserted
    - **Validates: Requirements 3.2, 3.3, 4.1, 4.2, 6.3, 6.4**

- [ ] 4. WalletService — contribution, payout, and transfer
  - [x] 4.1 Implement `payContribution`
    - `payContribution({ userId, groupId, cycleNumber, tcAmount })`: open DB transaction; `SELECT tc_balance FROM users WHERE id = $userId FOR UPDATE`; reject if balance < `tcAmount`; deduct balance; insert `contribution` transaction (type `contribution`, fee 0); return updated balance
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 10.1, 10.3_

  - [x] 4.2 Implement `creditPayout`
    - `creditPayout({ userId, groupId, payoutId, xafAmount })`: compute `tcAmount = xafAmount / 10000`; open DB transaction; `UPDATE users SET tc_balance = tc_balance + $tcAmount WHERE id = $userId`; insert `payout` transaction (type `payout`, fee 0); call `sendNotificationToUser` with TC amount received
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 10.1_

  - [x] 4.3 Implement `getTransferPreview`
    - `getTransferPreview({ senderId, recipientIdentifier, tcAmount })`: resolve recipient by phone or wallet_code; check common active group membership to determine fee (0 if shared group, else `ceil(tcAmount * 0.005 * 100) / 100`); call `exchangeRateService.convertTC` for each TC value; return full breakdown object
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 4.4 Implement `transfer`
    - `transfer({ senderId, recipientIdentifier, tcAmount })`: resolve recipient; call `checkLimits`; open DB transaction; `SELECT tc_balance FROM users WHERE id = $senderId FOR UPDATE`; compute fee; reject if sender balance < `tcAmount + fee`; deduct `tcAmount + fee` from sender; credit `tcAmount` to recipient (also with `FOR UPDATE`); insert `transfer_out` record for sender and `transfer_in` record for recipient; call `sendNotificationToUser` for recipient
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 10.1, 10.2, 10.3, 10.4_

  - [ ]* 4.5 Write property test for transfer atomicity and conservation (Property 5)
    - **Property 5: Transfer atomicity and conservation**
    - Generate arbitrary sender balance and transfer amount ≤ balance; assert sender delta = `-(amount + fee)`, recipient delta = `+amount`, and total TC in system decreases by exactly `fee`
    - **Validates: Requirements 6.7, 6.8, 6.9, 10.1**

  - [ ]* 4.6 Write property test for fee calculation correctness (Property 6)
    - **Property 6: Fee calculation correctness**
    - Generate arbitrary transfer amounts; assert fee = 0 for group-shared user pairs and `ceil(amount × 0.005 × 100) / 100` for external pairs; assert contribution and payout fees are always 0
    - **Validates: Requirements 4.5, 5.3, 6.5, 6.6**

  - [x] 4.7 Implement `getTransactions`
    - `getTransactions({ userId, type?, limit, offset })`: SELECT from `wallet_transactions` WHERE `user_id = $userId` (and optionally `type = $type`), ORDER BY `created_at DESC`, LIMIT/OFFSET; return rows and total count
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 4.8 Write property test for transaction history completeness (Property 8)
    - **Property 8: Transaction history completeness**
    - After each successful top-up, withdrawal, contribution, payout, and transfer operation, assert a matching `wallet_transactions` record exists with correct `type`, `tc_amount`, and `status = 'completed'`
    - **Validates: Requirements 2.4, 3.6, 4.4, 5.2, 6.8, 6.9**

- [ ] 5. Checkpoint — run all WalletService and ExchangeRateService tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. WalletController and wallet routes
  - [x] 6.1 Implement `backend/src/controllers/walletController.js`
    - `getWallet`: call `walletService.getWallet(req.user.id)`; return `{ tc_balance, wallet_code, preferred_currency }`
    - `topUp`: validate `xaf_amount` (integer ≥ 100) and `payment_method` (enum); call `walletService.topUp`
    - `withdraw`: validate `tc_amount` (number ≥ 0.01) and `destination` object; call `walletService.withdraw`
    - `transfer`: validate `recipient_identifier` (non-empty string) and `tc_amount` (number > 0); call `walletService.transfer`
    - `getTransferPreview`: validate query params `recipient_identifier` and `tc_amount`; call `walletService.getTransferPreview`
    - `getTransactions`: validate optional `type` query param and pagination params (`limit` ≤ 50, `offset`); call `walletService.getTransactions`
    - All handlers follow the existing `{ success, data }` / `{ success, message, code }` envelope pattern
    - _Requirements: 2.1, 3.1, 6.1, 7.1, 9.1, 9.4_

  - [x] 6.2 Create `backend/src/routes/wallet.js`
    - Mount all six routes as specified in the design (`GET /wallet`, `POST /wallet/topup`, `POST /wallet/withdraw`, `POST /wallet/transfer`, `GET /wallet/transfer/preview`, `GET /wallet/transactions`)
    - Apply `authenticate` middleware to all routes
    - Apply `requireProfileComplete` only to `withdraw`, `transfer`, and `getTransferPreview` (top-up and read routes are accessible to unverified users per Requirement 11.9)
    - _Requirements: 10.5, 11.1, 11.9_

  - [x] 6.3 Register wallet router in `backend/src/app.js`
    - Import and mount the wallet router at `/wallet`
    - _Requirements: 2.1, 3.1, 6.1_

- [ ] 7. Update existing backend files
  - [x] 7.1 Update `backend/src/controllers/authController.js`
    - In the `register` handler, after inserting the user and notification preferences, call `walletService.initWallet(userId)` to initialise the TC wallet
    - In `verifyOtp`, replace `trust_score` with `tc_balance` in the RETURNING clause
    - In `login`, replace `trust_score` with `tc_balance` in the SELECT query
    - _Requirements: 1.1, 1.6_

  - [x] 7.2 Update `backend/src/middleware/auth.js`
    - In the `authenticate` function, replace `trust_score` with `tc_balance` in the SELECT query so `req.user.tc_balance` is available
    - _Requirements: 1.6_

  - [x] 7.3 Update `backend/src/controllers/userController.js`
    - Replace all occurrences of `trust_score` with `tc_balance` in SELECT and RETURNING clauses in `getMe`, `updateMe`, `setupProfile`, and `updateProfilePicture`
    - Add `wallet_code` and `preferred_currency` to the `getMe` SELECT so the frontend can display wallet info
    - _Requirements: 1.6_

  - [x] 7.4 Update `backend/src/controllers/contributionController.js`
    - Add `tc_wallet` to the `payment_method` validation enum
    - In the `contribute` handler, after the duplicate-contribution check, branch on `payment_method === 'tc_wallet'`: call `walletService.payContribution({ userId, groupId, cycleNumber, tcAmount })` where `tcAmount = group.contribution_amount / 10000`; on success mark contribution `completed` and notify admin; skip `processPayment` for this branch
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.5 Update `backend/src/services/payoutQueueService.js`
    - Replace `trust_score` with `tc_balance` in the member SELECT query used for payout queue ordering
    - After the `UPDATE payouts SET status = 'completed'` step (add this step if missing), call `walletService.creditPayout({ userId, groupId, payoutId, xafAmount })` for the payout recipient
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 8. Checkpoint — run full backend test suite
  - Ensure all tests pass, ask the user if questions arise.

- [-] 9. Web frontend — API client and shared components
  - [x] 9.1 Create `web/src/api/wallet.js`
    - Implement `getWallet()`, `topUp(data)`, `withdraw(data)`, `transfer(data)`, `getTransferPreview(params)`, `getTransactions(params)` using the existing `client` (axios instance) from `web/src/api/client.js`
    - _Requirements: 2.1, 3.1, 6.1, 7.1, 9.1_

  - [x] 9.2 Create `web/src/components/TCBalance.jsx` and `TCBalance.module.css`
    - Accept `tcBalance` and `rates` (from `convertTC`) as props
    - Display TC amount prominently (2 decimal places)
    - Show XAF equivalent always; show a currency toggle to cycle through USD, EUR, GBP, NGN, GHS, KES
    - Show a staleness indicator (e.g. "⚠️ Rates may be outdated") when `rates.stale === true`
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [x] 9.3 Create `web/src/components/WalletCode.jsx` and `WalletCode.module.css`
    - Accept `walletCode` as prop; display it in a styled badge
    - Include a copy-to-clipboard button that writes `walletCode` to `navigator.clipboard`
    - _Requirements: 1.3, 1.5_

  - [x] 9.4 Create `web/src/components/TransferConfirm.jsx` and `TransferConfirm.module.css`
    - Accept `preview` object (from `getTransferPreview`) and `onConfirm` / `onCancel` callbacks
    - Display: TC to send, fee in TC, total TC deducted from sender, TC recipient receives, and fiat equivalents in preferred currency and XAF
    - Show a loading state while preview is fetching; show an error state if preview fails
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 10. Web frontend — Wallet pages
  - [x] 10.1 Create `web/src/pages/Wallet.jsx` and `Wallet.module.css`
    - On mount call `getWallet()` and `getTransactions({ limit: 5 })`
    - Render `TCBalance` component with balance and rates
    - Render `WalletCode` component
    - Render quick-action buttons linking to `/wallet/topup`, `/wallet/withdraw`, `/wallet/transfer`, `/wallet/transactions`
    - Show last 5 transactions as a preview list
    - _Requirements: 1.5, 8.1, 9.1_

  - [x] 10.2 Create `web/src/pages/TopUp.jsx` and `TopUp.module.css`
    - Form with XAF amount input (min 100) and payment method selector (`mtn_momo`, `orange_money`, `bank_transfer`, `card`)
    - On submit call `topUp()`; show success message with new balance or error message
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 10.3 Create `web/src/pages/Withdraw.jsx` and `Withdraw.module.css`
    - Form with TC amount input (min 0.01) and destination method selector with conditional sub-fields (phone for MoMo/Orange, account details for bank, card details for card)
    - On submit call `withdraw()`; show success or error; on limit error display which limit was exceeded and reset time
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 11.3, 11.5, 11.8_

  - [x] 10.4 Create `web/src/pages/Transfer.jsx` and `Transfer.module.css`
    - Step 1: recipient identifier input (phone or wallet code) and TC amount input; on "Preview" call `getTransferPreview()` and render `TransferConfirm` modal
    - Step 2 (inside modal): user confirms; call `transfer()`; show success or error
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3_

  - [x] 10.5 Create `web/src/pages/TransactionHistory.jsx` and `TransactionHistory.module.css`
    - Paginated list (50 per page) with type filter dropdown (`all`, `top_up`, `withdrawal`, `contribution`, `payout`, `transfer_in`, `transfer_out`)
    - Each row shows: type icon, description/counterparty, TC amount (+ or −), XAF equivalent, status badge, timestamp
    - Load more / pagination controls
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 10.6 Register wallet routes in `web/src/App.jsx`
    - Add `PrivateRoute` entries for `/wallet`, `/wallet/topup`, `/wallet/withdraw`, `/wallet/transfer`, `/wallet/transactions`
    - Import the five new page components
    - _Requirements: 1.5_

  - [x] 10.7 Update `web/src/components/Layout.jsx`
    - Add a `{ to: '/wallet', label: '💰 Wallet' }` entry to the `links` array in the sidebar nav
    - _Requirements: 1.5_

  - [x] 10.8 Update `web/src/pages/Dashboard.jsx` and `Dashboard.module.css`
    - Add a TC balance summary card below the stats row; fetch wallet data on mount; display TC balance and a "Go to Wallet" link to `/wallet`
    - Replace `trust_score` display with `tc_balance`
    - _Requirements: 1.6, 8.1_

- [ ] 11. Mobile frontend — API client and shared components
  - [x] 11.1 Create `mobile/src/api/wallet.js`
    - Implement `getWallet()`, `topUp(data)`, `withdraw(data)`, `transfer(data)`, `getTransferPreview(params)`, `getTransactions(params)` using the existing `client` from `mobile/src/api/client.js`
    - _Requirements: 2.1, 3.1, 6.1, 7.1, 9.1_

  - [x] 11.2 Create `mobile/src/components/TCBalance.js`
    - Accept `tcBalance` and `rates` props; display TC amount and XAF equivalent; include a touchable to cycle through other currencies; show staleness indicator when `rates.stale === true`
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [-] 11.3 Create `mobile/src/components/WalletCode.js`
    - Accept `walletCode` prop; display in a styled `Text`; include a copy button using `expo-clipboard` (`Clipboard.setStringAsync`)
    - _Requirements: 1.3, 1.5_

  - [ ] 11.4 Create `mobile/src/components/TransferConfirm.js`
    - A bottom-sheet or modal component accepting `preview`, `onConfirm`, `onCancel`; display full fee breakdown; show loading and error states
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 12. Mobile frontend — Wallet screens
  - [ ] 12.1 Create `mobile/src/screens/WalletScreen.js`
    - On mount call `getWallet()` and `getTransactions({ limit: 5 })`
    - Render `TCBalance`, `WalletCode`, quick-action buttons (Top Up, Withdraw, Transfer, History), and a 5-item transaction preview list
    - _Requirements: 1.5, 8.1, 9.1_

  - [ ] 12.2 Create `mobile/src/screens/TopUpScreen.js`
    - Form with XAF amount `TextInput` and payment method picker; submit calls `topUp()`; show success/error feedback
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ] 12.3 Create `mobile/src/screens/WithdrawScreen.js`
    - Form with TC amount input and destination method picker with conditional sub-fields; submit calls `withdraw()`; show limit errors with reset time
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 11.3, 11.5, 11.8_

  - [ ] 12.4 Create `mobile/src/screens/TransferScreen.js`
    - Step 1: recipient identifier and TC amount inputs; "Preview" button calls `getTransferPreview()` and opens `TransferConfirm` sheet
    - Step 2: user confirms; calls `transfer()`; shows success or error
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3_

  - [ ] 12.5 Create `mobile/src/screens/TransactionHistoryScreen.js`
    - FlatList with `onEndReached` pagination; type filter via a horizontal scroll of filter chips; each item shows type, counterparty, TC amount, XAF equivalent, status, and timestamp
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 12.6 Update `mobile/src/navigation/AppNavigator.js`
    - Add a `Wallet` tab to `MainTabs` with a wallet icon
    - Add stack screens `WalletScreen`, `TopUpScreen`, `WithdrawScreen`, `TransferScreen`, `TransactionHistoryScreen` to `AppStack`
    - Import all new screen components
    - _Requirements: 1.5_

  - [ ] 12.7 Update `mobile/src/screens/DashboardScreen.js`
    - Replace `trust_score` display with `tc_balance`
    - Add a TC balance card that fetches wallet data on mount and navigates to `WalletScreen` on press
    - _Requirements: 1.6, 8.1_

- [ ] 13. Checkpoint — run full test suite (backend + frontend)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Integration tests
  - [ ]* 14.1 Write integration test: full top-up flow
    - POST `/wallet/topup` with valid XAF amount and payment method; assert HTTP 200, `tc_balance` increased by `xafAmount / 10000`, and a `top_up` record exists in `wallet_transactions`
    - _Requirements: 2.2, 2.4, 10.1_

  - [ ]* 14.2 Write integration test: full withdrawal flow
    - Seed a user with sufficient balance; POST `/wallet/withdraw`; assert HTTP 200, `tc_balance` decreased by `tcAmount`, and a `withdrawal` record exists
    - _Requirements: 3.4, 3.6, 10.1_

  - [ ]* 14.3 Write integration test: withdrawal reversal on disbursement failure
    - Mock `processPayment` to fail for disbursement; POST `/wallet/withdraw`; assert HTTP 500, `tc_balance` unchanged, and no completed `withdrawal` record
    - _Requirements: 3.5, 10.2_

  - [ ]* 14.4 Write integration test: peer-to-peer transfer
    - Seed two users; POST `/wallet/transfer`; assert sender balance decreased by `amount + fee`, recipient balance increased by `amount`, and both `transfer_out` and `transfer_in` records exist
    - _Requirements: 6.7, 6.8, 6.9_

  - [ ]* 14.5 Write integration test: contribution via wallet
    - Seed a user with sufficient balance in an active group; POST `/groups/:id/contribute` with `payment_method: 'tc_wallet'`; assert contribution status `completed`, `tc_balance` decreased, and a `contribution` record exists in `wallet_transactions`
    - _Requirements: 4.1, 4.3, 4.4_

  - [ ]* 14.6 Write integration test: transaction history pagination
    - Seed 60 transactions for a user; GET `/wallet/transactions?limit=50&offset=0`; assert 50 rows returned; GET with `offset=50`; assert 10 rows returned
    - _Requirements: 9.1, 9.4_

  - [ ]* 14.7 Write integration test: limit enforcement
    - Attempt a withdrawal of 201 TC; assert HTTP 400 with `limitType: 'single'`; seed daily total of 490 TC and attempt 20 TC withdrawal; assert HTTP 400 with `limitType: 'daily'`
    - _Requirements: 11.3, 11.5, 11.6, 11.8_

- [ ] 15. Final checkpoint — ensure all tests pass
  - Run the full test suite; ensure all property-based tests, unit tests, and integration tests pass; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All balance mutations use `SELECT ... FOR UPDATE` inside explicit DB transactions — never update `tc_balance` outside `WalletService`
- The `tc_wallet` payment method in `contributionController` delegates entirely to `WalletService.payContribution`; no `processPayment` call is made for that branch
- Property tests use `fast-check` (compatible with the existing Jest setup in `backend/package.json`)
- The migration file must be applied before running any backend code that references `tc_balance`, `wallet_code`, or `wallet_transactions`
- `preferred_currency` defaults to `'XAF'`; the frontend should fall back to `'XAF'` if the field is absent
