import crypto from 'crypto';
import { FundingOrder, PaymentMethodType } from '../../shared/types';

export class OnrampService {
  private static WEBHOOK_SECRET = process.env.ONRAMP_WEBHOOK_SECRET || 'sandbox_onramp_secret_key_8921';

  /**
   * Initiate funding order with payment rail
   */
  public static async initiateFunding(params: {
    transferId: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethodType;
    senderVpaOrAccount?: string;
  }): Promise<FundingOrder> {
    const { transferId, amount, currency, paymentMethod, senderVpaOrAccount } = params;

    const providerOrderId = `ord_${currency.toLowerCase()}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const providerName =
      currency === 'INR'
        ? 'Razorpay Sandbox Direct'
        : currency === 'USD'
        ? 'Stripe ACH Sandbox'
        : 'Banking Partner Rail';

    const fundingOrder: FundingOrder = {
      id: `fo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      transferId,
      providerName,
      providerOrderId,
      paymentMethod,
      amount,
      currency,
      status: 'CAPTURED', // Auto-authorized in sandbox simulation mode
      paymentDetails: senderVpaOrAccount
        ? `Method: ${paymentMethod} (${senderVpaOrAccount})`
        : `Method: ${paymentMethod} (Simulated Sandbox Approval)`,
      authorizedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    return fundingOrder;
  }

  /**
   * Verify on-ramp webhook signature using HMAC SHA256
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

  /**
   * Generate test webhook signature for testing/simulation
   */
  public static generateTestSignature(payload: string): string {
    return crypto
      .createHmac('sha256', this.WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
  }
}
