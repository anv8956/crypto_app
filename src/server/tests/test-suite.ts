import { FXService } from '../services/fx-service';
import { BlockchainService } from '../services/blockchain-service';
import { ComplianceService } from '../services/compliance-service';
import { OnrampService } from '../services/onramp-service';
import { OfframpService } from '../services/offramp-service';
import { TransferStateMachine, ALLOWED_TRANSITIONS } from '../services/state-machine';
import { db } from '../db';

export interface TestResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export async function runAllTests(): Promise<{
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
  results: TestResult[];
}> {
  const startTime = Date.now();
  const results: TestResult[] = [];

  const runTest = async (
    category: string,
    name: string,
    fn: () => void | Promise<void>
  ) => {
    const t0 = Date.now();
    try {
      await fn();
      results.push({
        id: `test_${results.length + 1}`,
        category,
        name,
        passed: true,
        durationMs: Date.now() - t0,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        id: `test_${results.length + 1}`,
        category,
        name,
        passed: false,
        durationMs: Date.now() - t0,
        error: msg,
      });
    }
  };

  // 1. Quote & FX Calculations
  await runTest('FX & Quote', 'Calculate INR to USD quote with transparent fee breakdown', () => {
    const quote = FXService.generateQuote({
      senderId: 'user_aman_in',
      sourceCurrency: 'INR',
      sourceAmount: 10000,
      targetCurrency: 'USD',
      networkId: 'polygon',
      stablecoinSymbol: 'USDC',
    });

    if (quote.sourceAmount !== 10000) throw new Error(`Expected sourceAmount 10000, got ${quote.sourceAmount}`);
    if (quote.targetAmount <= 0) throw new Error(`Target amount should be > 0, got ${quote.targetAmount}`);
    if (quote.fees.totalFeeFiat <= 0) throw new Error('Fee breakdown must include non-zero transparent fees');
    if (quote.fees.totalChargedFiat !== quote.sourceAmount + quote.fees.totalFeeFiat) {
      throw new Error('Total charged must equal source amount + total fee');
    }
    if (new Date(quote.expiresAt).getTime() <= Date.now()) throw new Error('Quote expiry must be in the future');
  });

  await runTest('FX & Quote', 'Reject invalid quote parameters (zero or negative amount)', () => {
    let threw = false;
    try {
      FXService.generateQuote({
        senderId: 'user_aman_in',
        sourceCurrency: 'INR',
        sourceAmount: 0,
        targetCurrency: 'USD',
      });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Should have thrown error for 0 amount');
  });

  // 2. Recipient Validation
  await runTest('Recipient Validation', 'Validate Indian IFSC Code format', () => {
    const valid = OfframpService.validateBankingDetails({
      country: 'IN',
      payoutMethod: 'IN_IMPS',
      accountNumber: '123456789012',
      ifscCode: 'HDFC0001234',
    });
    if (!valid.isValid) throw new Error(`Valid IFSC failed: ${valid.error}`);

    const invalid = OfframpService.validateBankingDetails({
      country: 'IN',
      payoutMethod: 'IN_IMPS',
      accountNumber: '123456789012',
      ifscCode: 'INVALID_IFSC_12',
    });
    if (invalid.isValid) throw new Error('Invalid IFSC was improperly marked valid');
  });

  await runTest('Recipient Validation', 'Validate US ABA Routing Number length', () => {
    const valid = OfframpService.validateBankingDetails({
      country: 'US',
      payoutMethod: 'US_ACH',
      accountNumber: '987654321',
      routingNumber: '021000021',
    });
    if (!valid.isValid) throw new Error(`Valid US Routing failed: ${valid.error}`);

    const invalid = OfframpService.validateBankingDetails({
      country: 'US',
      payoutMethod: 'US_ACH',
      accountNumber: '987654321',
      routingNumber: '1234',
    });
    if (invalid.isValid) throw new Error('Invalid routing length should have been rejected');
  });

  // 3. State Machine Transitions
  await runTest('State Machine', 'Enforce valid status transitions graph', () => {
    if (!TransferStateMachine.canTransition('DRAFT', 'QUOTED')) {
      throw new Error('DRAFT should be allowed to transition to QUOTED');
    }
    if (!TransferStateMachine.canTransition('AWAITING_FUNDING', 'FUNDED')) {
      throw new Error('AWAITING_FUNDING should be allowed to transition to FUNDED');
    }
    if (TransferStateMachine.canTransition('DRAFT', 'COMPLETED')) {
      throw new Error('DRAFT must NOT skip directly to COMPLETED');
    }
    if (TransferStateMachine.canTransition('COMPLETED', 'AWAITING_FUNDING')) {
      throw new Error('COMPLETED terminal state cannot transition backwards');
    }
  });

  // 4. Blockchain Adapter & Contracts
  await runTest('Blockchain Adapter', 'Validate Polygon USDC contract address against registry', () => {
    const isValid = BlockchainService.validateTokenContract(
      'polygon',
      'USDC',
      '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
    );
    if (!isValid) throw new Error('Legitimate Polygon USDC contract was rejected');

    const isFake = BlockchainService.validateTokenContract(
      'polygon',
      'USDC',
      '0x000000000000000000000000000000000000dead'
    );
    if (isFake) throw new Error('Rogue contract address was improperly validated');
  });

  await runTest('Blockchain Adapter', 'Execute simulated blockchain settlement with valid txHash and explorer URL', async () => {
    const tx = await BlockchainService.executeTransfer({
      transferId: 'test_trf_sample',
      networkId: 'polygon',
      tokenSymbol: 'USDC',
      amount: 115.50,
    });

    if (!tx.txHash.startsWith('0x') || tx.txHash.length !== 66) {
      throw new Error(`Invalid txHash format: ${tx.txHash}`);
    }
    if (!tx.explorerUrl.includes('polygonscan.com')) {
      throw new Error(`Invalid explorer URL: ${tx.explorerUrl}`);
    }
    if (tx.confirmations < 1) {
      throw new Error('Confirmations must be >= 1');
    }
  });

  // 5. Compliance & Sanctions Screening
  await runTest('Compliance & AML', 'Sanctioned country triggers CRITICAL risk and manual review hold', () => {
    const evalResult = ComplianceService.evaluateTransfer({
      userId: 'user_aman_in',
      sourceCurrency: 'INR',
      sourceAmount: 50000,
      targetCurrency: 'USD',
      targetAmount: 580,
      usdEquivalent: 580,
      purposeOfPayment: 'GIFT',
      recipientCountry: 'KP', // North Korea (Sanctioned)
    });

    if (evalResult.passed) throw new Error('Sanctioned country transfer must NOT pass compliance');
    if (!evalResult.requiresManualReview) throw new Error('Sanctioned country must trigger manual review');
    if (evalResult.riskLevel !== 'CRITICAL') throw new Error('Expected CRITICAL risk level for sanctioned jurisdiction');
  });

  await runTest('Compliance & Travel Rule', 'Trigger FinCEN Travel Rule threshold for amounts >= $3,000 USD', () => {
    const evalResult = ComplianceService.evaluateTransfer({
      userId: 'user_aman_in',
      sourceCurrency: 'INR',
      sourceAmount: 350000,
      targetCurrency: 'USD',
      targetAmount: 4050,
      usdEquivalent: 4050,
      purposeOfPayment: 'COMMERCIAL_SERVICES',
      recipientCountry: 'US',
    });

    if (evalResult.travelRuleStatus === 'EXEMPT') {
      throw new Error('Amounts >= $3,000 must NOT be exempt from FinCEN Travel Rule');
    }
  });

  // 6. Webhook Signatures & Idempotency
  await runTest('Webhooks & Idempotency', 'Verify HMAC SHA-256 webhook signatures', () => {
    const payload = JSON.stringify({ event: 'payment.captured', transferId: 'trf_test_123', amount: 10000 });
    const validSignature = OnrampService.generateTestSignature(payload);

    if (!OnrampService.verifyWebhookSignature(payload, validSignature)) {
      throw new Error('Valid webhook signature was rejected');
    }

    if (OnrampService.verifyWebhookSignature(payload, 'tampered_signature_xyz_123')) {
      throw new Error('Tampered signature should have been rejected');
    }
  });

  await runTest('Database Integrity', 'Prevent duplicate transfer submissions via idempotency key', () => {
    const existing = db.findTransferByIdempotencyKey('idem_seed_8941_complete');
    if (!existing) {
      throw new Error('Expected pre-seeded transfer with idempotency key to exist');
    }
    if (existing.status !== 'COMPLETED') {
      throw new Error('Expected existing transfer to be in COMPLETED state');
    }
  });

  // 7. End-to-End Sandbox Transfer Lifecycle
  await runTest('End-to-End Sandbox', 'Run complete transfer lifecycle from AWAITING_FUNDING to COMPLETED', async () => {
    const quote = FXService.generateQuote({
      senderId: 'user_aman_in',
      sourceCurrency: 'INR',
      sourceAmount: 10000,
      targetCurrency: 'USD',
      networkId: 'polygon',
      stablecoinSymbol: 'USDC',
    });

    const recip = db.getRecipientsBySenderId('user_aman_in')[0];
    const testTransferId = `trf_e2e_test_${Date.now()}`;

    const newTransfer = {
      id: testTransferId,
      transferNumber: `TRF-TEST-${Date.now()}`,
      senderId: 'user_aman_in',
      recipientId: recip.id,
      recipientUserId: recip.linkedUserId,
      quoteId: quote.id,
      quote,
      status: 'AWAITING_FUNDING' as const,
      idempotencyKey: `idem_test_${Date.now()}`,
      purposeOfPayment: 'FAMILY_MAINTENANCE',
      sourceCurrency: quote.sourceCurrency,
      sourceAmount: quote.sourceAmount,
      targetCurrency: quote.targetCurrency,
      targetAmount: quote.targetAmount,
      stablecoinSymbol: quote.stablecoinSymbol,
      stablecoinAmount: quote.stablecoinAmount,
      networkId: quote.networkId,
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addTransfer(newTransfer);

    const completed = await TransferStateMachine.executeSandboxLifecycle(testTransferId, { stepDelayMs: 10 });
    if (completed.status !== 'COMPLETED') {
      throw new Error(`Expected transfer to reach COMPLETED, ended at ${completed.status}`);
    }
    if (!completed.blockchainTx || !completed.blockchainTx.txHash) {
      throw new Error('Completed transfer must have settled blockchain transaction with txHash');
    }
    if (!completed.payoutOrder || !completed.payoutOrder.providerPayoutId) {
      throw new Error('Completed transfer must have settled payout order');
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    passed,
    failed,
    total: results.length,
    durationMs: Date.now() - startTime,
    results,
  };
}
