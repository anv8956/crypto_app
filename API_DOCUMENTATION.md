# Borderless API Documentation

Borderless is a stablecoin-powered cross-border remittance engine designed to move fiat currency internationally across borders in seconds using regulated USD-pegged stablecoin rails (USDC) and local clearing networks (UPI, IMPS in India; FedNow, ACH in the US; Faster Payments in the UK; SEPA Instant in the EU).

---

## 1. Authentication & Sessions

### `GET /api/auth/me`
Retrieves currently authenticated session user, profile, verification KYC status, and persona switcher list.
- **Headers:** `x-user-id: <user_id>` (or Bearer Token)
- **Response:**
  ```json
  {
    "user": { "id": "user_aman_in", "email": "aman@example.com", "role": "SENDER" },
    "profile": { "legalFirstName": "Aman", "countryOfResidence": "IN" },
    "verification": { "tier": "TIER_2_ENHANCED", "status": "VERIFIED", "riskScore": 12 }
  }
  ```

### `POST /api/auth/register`
Creates a new sender or recipient account.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "legalFirstName": "Jane",
    "legalLastName": "Doe",
    "country": "US"
  }
  ```

### `POST /api/auth/verify-kyc`
Upgrades identity verification tier (Tier 1 Basic -> Tier 2 Enhanced -> Tier 3 Unlimited) and records audit logs.

---

## 2. FX Rates & Guaranteed Quotes

### `GET /api/corridors`
Returns all supported sending/receiving countries, base exchange rates, supported blockchain networks, and active stablecoins.

### `POST /api/quote`
Calculates real-time locked FX rate with transparent fee schedule.
- **Request Body:**
  ```json
  {
    "sourceCurrency": "INR",
    "sourceAmount": 10000,
    "targetCurrency": "USD",
    "networkId": "polygon",
    "stablecoinSymbol": "USDC"
  }
  ```
- **Response:**
  ```json
  {
    "id": "quote_173000000",
    "quoteReference": "QTE-INR-USD-918231",
    "sourceCurrency": "INR",
    "sourceAmount": 10000,
    "targetCurrency": "USD",
    "targetAmount": 115.50,
    "stablecoinSymbol": "USDC",
    "stablecoinAmount": 115.50,
    "guaranteedRate": 0.011550,
    "expiresAt": "2026-10-21T17:15:00.000Z",
    "fees": {
      "onrampFeeFiat": 35.0,
      "applicationFeeFiat": 25.0,
      "networkFeeFiat": 0.86,
      "offrampFeeFiat": 20.0,
      "totalFeeFiat": 80.86,
      "totalChargedFiat": 10080.86
    }
  }
  ```

---

## 3. Beneficiaries & Bank Validation

### `GET /api/recipients`
Returns saved beneficiaries for the authenticated sender.

### `POST /api/recipients`
Validates country banking identifiers (e.g. 11-char IFSC code for India, 9-digit ABA routing number for US, IBAN for Europe) and encrypts sensitive account details.
- **Request Body:**
  ```json
  {
    "fullName": "Rahul Patel",
    "email": "rahul@example.com",
    "country": "US",
    "payoutMethod": "US_FEDNOW",
    "relationship": "Friend",
    "bankName": "JPMorgan Chase",
    "accountNumber": "123456789",
    "routingNumber": "021000021"
  }
  ```

---

## 4. Transfers & State Machine

### `GET /api/transfers`
Returns all transfers for the active user (filtered by sender or recipient).

### `GET /api/transfers/:id`
Returns transfer details including full audit events timeline, blockchain transaction data (txHash, block, confirmations), onramp funding order, and FedNow payout clearing reference.

### `POST /api/transfers`
Creates a transfer order. Enforces quote validity and idempotency keys to prevent duplicate transactions.
- **Request Body:**
  ```json
  {
    "quoteId": "quote_173000000",
    "recipientId": "recip_rahul",
    "idempotencyKey": "idem_req_928131",
    "purposeOfPayment": "FAMILY_MAINTENANCE",
    "senderNotes": "Split for dinner",
    "paymentMethod": "UPI",
    "autoExecute": true
  }
  ```

### `POST /api/transfers/:id/action`
Allows admins or compliance officers to release compliance holds (`RELEASE_COMPLIANCE_HOLD`) or cancel orders.

---

## 5. Admin & Compliance

### `GET /api/admin/metrics`
Returns aggregate volume, success rate, active corridors, and pending reviews.

### `GET /api/admin/compliance-queue`
Returns transfers currently held for review (e.g. FinCEN Travel Rule threshold >= $3,000, high risk score, or sanctions match).

### `GET /api/admin/audit-logs`
Returns immutable ledger of all system transitions and administrative approvals.

### `POST /api/admin/reset-database`
Resets the sandbox database back to the initial fictional seed data.

---

## 6. Webhooks

### `POST /api/webhooks/onramp`
Receives payment authorization callbacks with HMAC SHA-256 signature verification in `x-onramp-signature` header.

### `POST /api/webhooks/offramp`
Receives payout confirmation callbacks from bank clearing partners with HMAC SHA-256 signature in `x-offramp-signature` header.

---

## 7. Automated Test Suite

### `GET /api/tests/run`
Executes all unit, integration, and state machine test cases asynchronously and returns structured JSON with assertion timings.
