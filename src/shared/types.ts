/**
 * Shared Type Definitions for Borderless Stablecoin Remittance Engine
 */

export type Role = 'SENDER' | 'RECIPIENT' | 'ADMIN' | 'COMPLIANCE_OFFICER';

export type KycTier = 'TIER_0_UNVERIFIED' | 'TIER_1_BASIC' | 'TIER_2_ENHANCED' | 'TIER_3_UNLIMITED';

export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'DOCS_REQUESTED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TransferStatus =
  | 'DRAFT'
  | 'QUOTED'
  | 'AWAITING_FUNDING'
  | 'FUNDED'
  | 'COMPLIANCE_REVIEW'
  | 'CONVERSION_PENDING'
  | 'CRYPTO_TRANSFER_PENDING'
  | 'CRYPTO_SETTLED'
  | 'PAYOUT_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FUNDING_FAILED'
  | 'CONVERSION_FAILED'
  | 'CRYPTO_TRANSFER_FAILED'
  | 'PAYOUT_FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'COMPLIANCE_HOLD'
  | 'MANUAL_REVIEW';

export type PaymentMethodType =
  | 'UPI'
  | 'IMPS'
  | 'NET_BANKING'
  | 'ACH_DEBIT'
  | 'FEDNOW'
  | 'SEPA'
  | 'FASTER_PAYMENTS'
  | 'CARD'
  | 'DOMESTIC_WIRE';

export type PayoutMethodType =
  | 'US_ACH'
  | 'US_FEDNOW'
  | 'US_WIRE'
  | 'IN_IMPS'
  | 'IN_UPI'
  | 'EU_SEPA'
  | 'UK_FPS'
  | 'CRYPTO_WALLET';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  legalFirstName: string;
  legalLastName: string;
  countryOfResidence: string; // ISO 2, e.g. "IN" or "US"
  phoneNumber: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  dateOfBirth?: string;
  taxIdNumber?: string; // PAN or SSN masked
  occupation?: string;
  sourceOfFunds?: string;
}

export interface Verification {
  id: string;
  userId: string;
  tier: KycTier;
  status: VerificationStatus;
  idDocumentType?: string;
  idDocumentNumber?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  sanctionScreened: boolean;
  pepScreened: boolean;
  reviewedBy?: string;
  reviewNotes?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipientBankAccount {
  id: string;
  recipientId: string;
  bankName: string;
  accountNumberMasked: string;
  routingNumber?: string;
  swiftBic?: string;
  ifscCode?: string;
  iban?: string;
  accountType: 'CHECKING' | 'SAVINGS';
  currency: string;
  createdAt: string;
}

export interface Recipient {
  id: string;
  senderId: string;
  linkedUserId?: string;
  fullName: string;
  email: string;
  phone?: string;
  country: string;
  payoutMethod: PayoutMethodType;
  relationship: string;
  isVerified: boolean;
  bankAccount: RecipientBankAccount;
  createdAt: string;
}

export interface SupportedNetwork {
  id: string;
  name: string;
  chainId: number;
  nativeCurrency: string;
  blockExplorerUrl: string;
  averageBlockTimeSec: number;
  confirmationsRequired: number;
  isTestnet: boolean;
  rpcUrl: string;
}

export interface SupportedStablecoin {
  symbol: string;
  name: string;
  networkId: string;
  contractAddress: string;
  decimals: number;
  issuer: string;
  isActive: boolean;
}

export interface FeeBreakdown {
  onrampFeeFiat: number;
  applicationFeeFiat: number;
  networkFeeFiat: number;
  offrampFeeFiat: number;
  totalFeeFiat: number;
  totalChargedFiat: number;
}

export interface ExchangeQuote {
  id: string;
  quoteReference: string;
  senderId: string;
  sourceCurrency: string;
  sourceAmount: number;
  targetCurrency: string;
  targetAmount: number;
  stablecoinSymbol: string;
  stablecoinAmount: number;
  networkId: string;
  fxRateSourceToUSD: number;
  marketRate: number; // e.g. 1 USD = 84.50 INR, or 1 INR = 0.01183 USD
  guaranteedRate: number;
  spreadPercent: number;
  expiresAt: string;
  createdAt: string;
  fees: FeeBreakdown;
  estimatedDeliveryMinutes: number;
}

export interface TransferEvent {
  id: string;
  transferId: string;
  previousStatus: TransferStatus | null;
  newStatus: TransferStatus;
  reason: string;
  metadata?: Record<string, unknown>;
  actorRole: string;
  actorId?: string;
  createdAt: string;
}

export interface BlockchainTransaction {
  id: string;
  transferId: string;
  networkId: string;
  tokenSymbol: string;
  tokenAddress: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amountUnits: number;
  gasPriceGwei: number;
  gasUsed: number;
  blockNumber: number;
  confirmations: number;
  status: 'SUBMITTED' | 'CONFIRMED' | 'FINALIZED' | 'FAILED';
  explorerUrl: string;
  settledAt?: string;
  createdAt: string;
}

export interface FundingOrder {
  id: string;
  transferId: string;
  providerName: string;
  providerOrderId: string;
  paymentMethod: PaymentMethodType;
  amount: number;
  currency: string;
  status: 'INITIATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED';
  paymentDetails: string;
  authorizedAt?: string;
  createdAt: string;
}

export interface PayoutOrder {
  id: string;
  transferId: string;
  providerName: string;
  providerPayoutId: string;
  payoutMethod: PayoutMethodType;
  amount: number;
  currency: string;
  destinationBank: string;
  accountNumberMasked: string;
  fedReferenceNumber?: string;
  status: 'INITIATED' | 'IN_CLEARING' | 'PAID_OUT' | 'REJECTED';
  paidOutAt?: string;
  createdAt: string;
}

export interface ComplianceCase {
  id: string;
  transferId: string;
  assignedOfficerId?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  flagReasons: string[];
  sanctionHit: boolean;
  travelRuleStatus: 'PASSED' | 'EXEMPT' | 'INFO_REQUIRED';
  status: 'OPEN' | 'IN_REVIEW' | 'CLEARED' | 'REJECTED' | 'ESCALATED';
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface Transfer {
  id: string;
  transferNumber: string;
  senderId: string;
  recipientId: string;
  recipientUserId?: string;
  quoteId: string;
  status: TransferStatus;
  idempotencyKey: string;
  purposeOfPayment: string;
  senderNotes?: string;

  sourceCurrency: string;
  sourceAmount: number;
  targetCurrency: string;
  targetAmount: number;
  stablecoinSymbol: string;
  stablecoinAmount: number;
  networkId: string;

  // Embedded related records
  quote?: ExchangeQuote;
  recipient?: Recipient;
  senderProfile?: UserProfile;
  events: TransferEvent[];
  fundingOrder?: FundingOrder;
  blockchainTx?: BlockchainTransaction;
  payoutOrder?: PayoutOrder;
  complianceCase?: ComplianceCase;

  fundedAt?: string;
  cryptoSettledAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'TRANSFER_STATUS' | 'KYC_UPDATE' | 'PAYMENT_RECEIVED' | 'SECURITY_ALERT';
  transferId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface CountryCorridor {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  flag: string;
  isSource: boolean;
  isDestination: boolean;
  supportedPaymentMethods: PaymentMethodType[];
  supportedPayoutMethods: PayoutMethodType[];
  minAmount: number;
  maxAmount: number;
  legalRequirements: string;
}
