# Borderless — Stablecoin-Powered International Money Transfer App

**Borderless** is a production-oriented cross-border remittance application enabling near-instant, low-cost international transfers using regulated USD-pegged stablecoin rails (USDC) with local-currency payouts directly into recipients' bank accounts.

---

## 1. Core Architecture & Workflow

### The Primary Use Case: India (INR) to United States (USD)
1. **Sender Experience (Aman in Bengaluru):**
   - Aman registers, undergoes KYC verification (PAN + Aadhaar validation), and enters an amount of ₹10,000 INR.
   - The platform calculates a transparent, guaranteed quote locked for 15 minutes:
     - Real-time market rate: 1 USD = 86.42 INR (1 INR = ~0.01157 USD)
     - Transparent fee breakdown: On-ramp fee (₹35), Borderless service fee (₹25), Polygon gas fee (~₹0.86), and FedNow payout fee (₹20). Total fee: ~₹80.86 (~$0.95 USD), compared to ~$45.00+ for traditional SWIFT bank wires.
   - Aman selects his friend **Rahul Patel** in San Francisco and authorizes domestic funding via UPI / IMPS.
2. **On-Ramp & Liquidity Minting:**
   - Domestic INR funds are captured and verified.
   - The compliance engine performs real-time AML sanctions screening (OFAC SDN list) and checks Tier limits and FinCEN Travel Rule requirements.
   - Equivalent eligible funds are converted into **USDC** (Circle USD Coin).
3. **Blockchain Settlement Layer:**
   - USDC is transferred on **Polygon PoS** (or Arbitrum / Base) to the verified payout liquidity vault.
   - The transaction settles on-chain with verifiable block numbers, gas metrics, and public transaction hashes (viewable on PolygonScan).
4. **Off-Ramp & Local Bank Deposit:**
   - The US payout partner redeems the USDC for fiat USD and dispatches an instant **FedNow / ACH credit** directly into Rahul's JPMorgan Chase account.
   - Both Aman and Rahul receive instant notifications with transaction receipts and Fedwire/FedNow reference numbers.

---

## 2. Technology Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Motion, Lucide icons, Canvas Confetti.
- **Backend:** Express full-stack service mounted on port 3000 with Vite middleware in development and static bundle serving in production.
- **Database Layer:**
  - Complete PostgreSQL relational schema defined in `prisma/schema.prisma` with 20+ models (User, Profile, Verification, Recipient, BankAccount, Transfer, TransferEvent, FundingOrder, BlockchainTx, PayoutOrder, FeeBreakdown, ComplianceCase, RiskAssessment, AuditLog).
  - High-integrity transactional store in `src/server/db.ts` with ACID-like atomic disk persistence in `.data/db.json` and auto-seed hydration.
- **State Machine:** Explicit allowed transition engine (`src/server/services/state-machine.ts`) with timestamped immutable event logging.
- **Blockchain Adapter:** Multi-chain token registry (Polygon, Arbitrum, Base, Ethereum) with contract validation, gas estimator, confirmation simulator, and anti-replay protection.
- **Testing:** Automated test suite runner (`src/server/tests/test-suite.ts`) executable via `npm test` or directly inside the in-app Developer drawer.

---

## 3. Getting Started & Running Locally

### Prerequisites
- Node.js 18+ (Node 22 recommended)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/borderless.git
cd borderless

# Install dependencies
npm install

# Start the full-stack server
npm run dev
```

Open `http://localhost:3000` in your browser.

### Running Automated Tests
```bash
npm test
```
Or click the **"Run Automated Test Suite"** button in the app header to execute all 10+ tests live in the browser.

---

## 4. User Personas for Evaluation

Use the persona dropdown in the top-right corner to test all three user flows seamlessly:

1. **Aman Sharma (Sender Persona - India):**
   - Verified KYC Tier 2.
   - Send INR to US, add recipients with US routing numbers, test live quote lock, and trigger UPI funding.
2. **Rahul Patel (Recipient Persona - US):**
   - Verified Chase Bank account.
   - View received incoming payments, FedNow clearing references, and transaction receipts.
3. **Elena Vance (Admin & Compliance Officer):**
   - Access the **Admin & Compliance Console**.
   - Review the risk queue (e.g. transfers exceeding $3,000 Travel Rule thresholds).
   - Inspect risk scores, review audit logs, and approve/release compliance holds.

---

## 5. Definition of Done & Production Readiness

### What is Genuinely Working in Sandbox Mode:
- Registration, login, and persona switching.
- Recipient creation with strict bank identifier validation (Indian IFSC format, US 9-digit ABA routing format, IBAN).
- Real-time guaranteed FX quote generator with 15-minute lock timer and mathematical precision.
- Complete state machine progression:
  `DRAFT → QUOTED → AWAITING_FUNDING → FUNDED → COMPLIANCE_REVIEW → CONVERSION_PENDING → CRYPTO_TRANSFER_PENDING → CRYPTO_SETTLED → PAYOUT_PENDING → COMPLETED`.
- Compliance engine that automatically flags high amounts (e.g. > $3,000 for Travel Rule) into `COMPLIANCE_HOLD` and allows Admin release.
- Blockchain adapter with verifiable transaction hashes, Polygon block numbers, and explorer links.
- Recipient view with FedNow confirmation and download/printable receipt.
- In-app and CLI automated test suite passing all tests.

### Production Release Gate Prerequisites:
To transition this sandbox into a live real-money production application:
1. **Regulated Custody & Key Management:** Replace sandbox key generation with Circle Programmable Wallets or Fireblocks MPC (Multi-Party Computation) signing service.
2. **Banking & On-Ramp Partner:** Bind live API keys for Razorpay / Plaid / Stripe to accept real UPI and ACH payments.
3. **Off-Ramp Payout Clearing:** Connect Circle Mint API or Bridge.xyz to perform automated 1:1 USDC burn and FedNow / SEPA direct credit into beneficiary accounts.
4. **Compliance & Sanctions Provider:** Integrate ComplyAdvantage / Chainalysis for real-time OFAC SDN sanctions screening and Travel Rule information exchange (TRISA / Notabene).
5. **Licensing & Legal:** Secure Money Transmitter Licenses (MTL) or FinCEN MSB partnership in the US, and RBI Authorised Dealer Category II / FIU-IND VDA registration in India.
