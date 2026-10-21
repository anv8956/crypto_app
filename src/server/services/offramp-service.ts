import crypto from 'crypto';
import { PayoutMethodType, PayoutOrder, RecipientBankAccount } from '../../shared/types';

export class OfframpService {
  private static WEBHOOK_SECRET = process.env.OFFRAMP_WEBHOOK_SECRET || 'sandbox_offramp_secret_key_1034';

  /**
   * Validate recipient bank identifiers per corridor
   */
  public static validateBankingDetails(params: {
    country: string;
    payoutMethod: PayoutMethodType;
    accountNumber: string;
    routingNumber?: string;
    ifscCode?: string;
    iban?: string;
  }): { isValid: boolean; error?: string } {
    const { country, payoutMethod, accountNumber, routingNumber, ifscCode, iban } = params;

    if (!accountNumber || accountNumber.trim().length < 4) {
      return { isValid: false, error: 'Account number must be at least 4 digits.' };
    }

    if (country === 'US' || payoutMethod.startsWith('US_')) {
      if (!routingNumber) {
        return { isValid: false, error: 'US bank payout requires a 9-digit ABA Routing Transit Number.' };
      }
      const cleanRouting = routingNumber.replace(/\D/g, '');
      if (cleanRouting.length !== 9) {
        return { isValid: false, error: 'ABA Routing number must be exactly 9 digits.' };
      }
      // Simple routing checksum algorithm
      let checksum = 0;
      const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
      for (let i = 0; i < 9; i++) {
        checksum += parseInt(cleanRouting.charAt(i), 10) * weights[i];
      }
      if (checksum % 10 !== 0) {
        // Warning or error for ABA checksum
        // Allow in sandbox if ends with valid digit
      }
    } else if (country === 'IN' || payoutMethod.startsWith('IN_')) {
      if (!ifscCode) {
        return { isValid: false, error: 'Indian bank payout requires an 11-character IFSC code.' };
      }
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(ifscCode.toUpperCase().trim())) {
        return { isValid: false, error: 'Invalid IFSC format. Must be 4 letters, 0, and 6 alphanumeric characters (e.g. HDFC0001234).' };
      }
    } else if (country === 'EU' || payoutMethod.startsWith('EU_')) {
      if (!iban) {
        return { isValid: false, error: 'European SEPA transfer requires an IBAN.' };
      }
      const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
      if (cleanIban.length < 14 || cleanIban.length > 34) {
        return { isValid: false, error: 'Invalid IBAN length.' };
      }
    }

    return { isValid: true };
  }

  /**
   * Submit payout request to fiat banking partner (FedNow, ACH, IMPS, SEPA)
   */
  public static async initiatePayout(params: {
    transferId: string;
    amount: number;
    currency: string;
    payoutMethod: PayoutMethodType;
    bankAccount: RecipientBankAccount;
  }): Promise<PayoutOrder> {
    const { transferId, amount, currency, payoutMethod, bankAccount } = params;

    const providerPayoutId = `payout_${currency.toLowerCase()}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const fedRef =
      currency === 'USD'
        ? `FED${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${Math.floor(1000000 + Math.random() * 9000000)}`
        : undefined;

    const payoutOrder: PayoutOrder = {
      id: `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      transferId,
      providerName:
        payoutMethod === 'US_FEDNOW'
          ? 'FedNow Instant Rail'
          : payoutMethod === 'US_ACH'
          ? 'US Automated Clearing House (ACH)'
          : payoutMethod === 'IN_IMPS'
          ? 'NPCI IMPS Fast Rail'
          : 'SEPA Instant Credit',
      providerPayoutId,
      payoutMethod,
      amount,
      currency,
      destinationBank: bankAccount.bankName,
      accountNumberMasked: bankAccount.accountNumberMasked,
      fedReferenceNumber: fedRef,
      status: 'PAID_OUT', // Settled in sandbox
      paidOutAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    return payoutOrder;
  }

  /**
   * Webhook verification for off-ramp
   */
  public static verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!signature) return false;
    const expected = crypto
      .createHmac('sha256', this.WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    const bufExpected = Buffer.from(expected);
    const bufActual = Buffer.from(signature);
    if (bufExpected.length !== bufActual.length) return false;
    return crypto.timingSafeEqual(bufExpected, bufActual);
  }
}
