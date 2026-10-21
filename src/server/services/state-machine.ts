import { Transfer, TransferEvent, TransferStatus } from '../../shared/types';
import { db } from '../db';
import { BlockchainService } from './blockchain-service';
import { ComplianceService } from './compliance-service';
import { OfframpService } from './offramp-service';
import { OnrampService } from './onramp-service';

export const ALLOWED_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  DRAFT: ['QUOTED', 'CANCELLED'],
  QUOTED: ['AWAITING_FUNDING', 'CANCELLED'],
  AWAITING_FUNDING: ['FUNDED', 'FUNDING_FAILED', 'CANCELLED'],
  FUNDED: ['COMPLIANCE_REVIEW', 'REFUND_PENDING'],
  COMPLIANCE_REVIEW: ['CONVERSION_PENDING', 'COMPLIANCE_HOLD', 'MANUAL_REVIEW', 'REFUND_PENDING'],
  COMPLIANCE_HOLD: ['CONVERSION_PENDING', 'CANCELLED', 'REFUND_PENDING'],
  MANUAL_REVIEW: ['CONVERSION_PENDING', 'CANCELLED', 'REFUND_PENDING'],
  CONVERSION_PENDING: ['CRYPTO_TRANSFER_PENDING', 'CONVERSION_FAILED', 'REFUND_PENDING'],
  CONVERSION_FAILED: ['REFUND_PENDING', 'CANCELLED'],
  CRYPTO_TRANSFER_PENDING: ['CRYPTO_SETTLED', 'CRYPTO_TRANSFER_FAILED'],
  CRYPTO_TRANSFER_FAILED: ['REFUND_PENDING', 'MANUAL_REVIEW'],
  CRYPTO_SETTLED: ['PAYOUT_PENDING'],
  PAYOUT_PENDING: ['COMPLETED', 'PAYOUT_FAILED'],
  PAYOUT_FAILED: ['REFUND_PENDING', 'MANUAL_REVIEW'],
  REFUND_PENDING: ['REFUNDED'],
  REFUNDED: [],
  COMPLETED: [],
  CANCELLED: [],
  FUNDING_FAILED: [],
};

export class TransferStateMachine {
  /**
   * Check if transition is legal
   */
  public static canTransition(currentStatus: TransferStatus, nextStatus: TransferStatus): boolean {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  /**
   * Transition a transfer to a new status with validation and audit logging
   */
  public static transition(params: {
    transferId: string;
    nextStatus: TransferStatus;
    reason: string;
    actorRole: string;
    actorId?: string;
    metadata?: Record<string, unknown>;
  }): Transfer {
    const { transferId, nextStatus, reason, actorRole, actorId, metadata } = params;

    const transfer = db.findTransferById(transferId);
    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    if (!this.canTransition(transfer.status, nextStatus)) {
      throw new Error(
        `Invalid status transition from ${transfer.status} to ${nextStatus}. Allowed: [${(
          ALLOWED_TRANSITIONS[transfer.status] || []
        ).join(', ')}]`
      );
    }

    const prevStatus = transfer.status;

    // Record Event
    db.addTransferEvent(transferId, {
      previousStatus: prevStatus,
      newStatus: nextStatus,
      reason,
      actorRole,
      actorId,
      metadata,
    });

    // Update timestamps on status milestones
    const updates: Partial<Transfer> = { status: nextStatus };
    if (nextStatus === 'FUNDED') updates.fundedAt = new Date().toISOString();
    if (nextStatus === 'CRYPTO_SETTLED') updates.cryptoSettledAt = new Date().toISOString();
    if (nextStatus === 'COMPLETED') updates.completedAt = new Date().toISOString();
    if (nextStatus === 'CANCELLED') updates.cancelledAt = new Date().toISOString();

    const updated = db.updateTransfer(transferId, updates)!;

    // Record System Audit Log
    db.addAuditLog({
      userId: actorId,
      action: `STATUS_TRANSITION_${nextStatus}`,
      entityType: 'Transfer',
      entityId: transferId,
      details: {
        from: prevStatus,
        to: nextStatus,
        reason,
        actorRole,
        metadata,
      },
    });

    return updated;
  }

  /**
   * Execute full sandbox automated flow from AWAITING_FUNDING -> COMPLETED
   * Or stops at COMPLIANCE_HOLD if risk flags are triggered
   */
  public static async executeSandboxLifecycle(transferId: string, options?: { stepDelayMs?: number }): Promise<Transfer> {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const stepDelay = options?.stepDelayMs ?? 400;

    let transfer = db.findTransferById(transferId);
    if (!transfer) throw new Error(`Transfer ${transferId} not found`);

    // 1. FUNDED
    if (transfer.status === 'AWAITING_FUNDING') {
      const fundingOrder = await OnrampService.initiateFunding({
        transferId: transfer.id,
        amount: transfer.sourceAmount,
        currency: transfer.sourceCurrency,
        paymentMethod: transfer.fundingOrder?.paymentMethod || 'UPI',
      });
      transfer.fundingOrder = fundingOrder;
      transfer = this.transition({
        transferId,
        nextStatus: 'FUNDED',
        reason: `${transfer.sourceCurrency} ${transfer.sourceAmount} confirmed by on-ramp provider (${fundingOrder.providerName})`,
        actorRole: 'PROVIDER',
      });
    }

    await delay(stepDelay);

    // 2. COMPLIANCE_REVIEW
    if (transfer.status === 'FUNDED') {
      const recipient = db.findRecipientById(transfer.recipientId);
      const evalResult = ComplianceService.evaluateTransfer({
        userId: transfer.senderId,
        sourceCurrency: transfer.sourceCurrency,
        sourceAmount: transfer.sourceAmount,
        targetCurrency: transfer.targetCurrency,
        targetAmount: transfer.targetAmount,
        usdEquivalent: transfer.stablecoinAmount,
        purposeOfPayment: transfer.purposeOfPayment,
        recipientCountry: recipient?.country || 'US',
      });

      const complianceCase = ComplianceService.createComplianceCase(transfer.id, evalResult);
      transfer.complianceCase = complianceCase;

      if (evalResult.requiresManualReview) {
        transfer = this.transition({
          transferId,
          nextStatus: 'COMPLIANCE_HOLD',
          reason: `High risk score (${evalResult.riskScore}/100) or regulatory flag: ${evalResult.flagReasons.join('; ')}`,
          actorRole: 'SYSTEM',
          metadata: { riskScore: evalResult.riskScore, flags: evalResult.flagReasons },
        });

        // Notify user & compliance team
        db.addNotification({
          userId: transfer.senderId,
          title: 'Transfer Under Compliance Review',
          body: `Transfer ${transfer.transferNumber} requires standard compliance review due to corridor limits.`,
          type: 'TRANSFER_STATUS',
          transferId: transfer.id,
        });

        return transfer; // Pauses here until Admin clears it!
      } else {
        transfer = this.transition({
          transferId,
          nextStatus: 'COMPLIANCE_REVIEW',
          reason: `Automated AML & sanctions checks passed with clean risk score (${evalResult.riskScore}/100)`,
          actorRole: 'SYSTEM',
        });
      }
    }

    await delay(stepDelay);

    // 3. CONVERSION_PENDING
    if (transfer.status === 'COMPLIANCE_REVIEW') {
      transfer = this.transition({
        transferId,
        nextStatus: 'CONVERSION_PENDING',
        reason: `Allocating liquidity pool for ${transfer.stablecoinAmount} ${transfer.stablecoinSymbol} minting`,
        actorRole: 'SYSTEM',
      });
    }

    await delay(stepDelay);

    // 4. CRYPTO_TRANSFER_PENDING
    if (transfer.status === 'CONVERSION_PENDING') {
      transfer = this.transition({
        transferId,
        nextStatus: 'CRYPTO_TRANSFER_PENDING',
        reason: `Broadcasting ${transfer.stablecoinAmount} ${transfer.stablecoinSymbol} transaction to ${transfer.networkId} network`,
        actorRole: 'SYSTEM',
      });
    }

    await delay(stepDelay);

    // 5. CRYPTO_SETTLED
    if (transfer.status === 'CRYPTO_TRANSFER_PENDING') {
      const blockchainTx = await BlockchainService.executeTransfer({
        transferId: transfer.id,
        networkId: transfer.networkId,
        tokenSymbol: transfer.stablecoinSymbol,
        amount: transfer.stablecoinAmount,
      });
      transfer.blockchainTx = blockchainTx;

      transfer = this.transition({
        transferId,
        nextStatus: 'CRYPTO_SETTLED',
        reason: `Settled on-chain in Block #${blockchainTx.blockNumber} with ${blockchainTx.confirmations} confirmations (tx: ${blockchainTx.txHash.slice(0, 10)}...)`,
        actorRole: 'SYSTEM',
        metadata: { txHash: blockchainTx.txHash, explorerUrl: blockchainTx.explorerUrl },
      });
    }

    await delay(stepDelay);

    // 6. PAYOUT_PENDING
    if (transfer.status === 'CRYPTO_SETTLED') {
      transfer = this.transition({
        transferId,
        nextStatus: 'PAYOUT_PENDING',
        reason: `Initiating fiat local currency payout of ${transfer.targetCurrency} ${transfer.targetAmount} to destination bank`,
        actorRole: 'PROVIDER',
      });
    }

    await delay(stepDelay);

    // 7. COMPLETED
    if (transfer.status === 'PAYOUT_PENDING') {
      const recipient = db.findRecipientById(transfer.recipientId);
      if (recipient) {
        const payoutOrder = await OfframpService.initiatePayout({
          transferId: transfer.id,
          amount: transfer.targetAmount,
          currency: transfer.targetCurrency,
          payoutMethod: recipient.payoutMethod,
          bankAccount: recipient.bankAccount,
        });
        transfer.payoutOrder = payoutOrder;
      }

      transfer = this.transition({
        transferId,
        nextStatus: 'COMPLETED',
        reason: `Funds successfully delivered into recipient's account. Payout confirmed by clearing partner.`,
        actorRole: 'PROVIDER',
      });

      // Send notifications to sender & recipient
      db.addNotification({
        userId: transfer.senderId,
        title: 'Transfer Completed Successfully',
        body: `Your transfer ${transfer.transferNumber} of ${transfer.sourceCurrency} ${transfer.sourceAmount} has been delivered to ${recipient?.fullName || 'the recipient'}.`,
        type: 'TRANSFER_STATUS',
        transferId: transfer.id,
      });

      if (transfer.recipientUserId) {
        db.addNotification({
          userId: transfer.recipientUserId,
          title: 'Money Received in Bank',
          body: `You received ${transfer.targetCurrency} ${transfer.targetAmount} from ${transfer.senderProfile?.legalFirstName || 'Aman'}.`,
          type: 'PAYMENT_RECEIVED',
          transferId: transfer.id,
        });
      }
    }

    return transfer;
  }
}
