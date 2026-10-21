import { Router, Request, Response } from 'express';
import { db } from './db';
import { FXService } from './services/fx-service';
import { BlockchainService } from './services/blockchain-service';
import { ComplianceService } from './services/compliance-service';
import { OnrampService } from './services/onramp-service';
import { OfframpService } from './services/offramp-service';
import { TransferStateMachine } from './services/state-machine';
import { CORRIDORS, SUPPORTED_NETWORKS, SUPPORTED_STABLECOINS, BASE_FX_RATES } from '../shared/constants';
import { Transfer, Recipient, User, UserProfile, Verification } from '../shared/types';
import { runAllTests } from './tests/test-suite';

export const apiRouter = Router();

// Middleware to mock session user from header or default to Aman
const getUserFromReq = (req: Request): User => {
  const userId = (req.headers['x-user-id'] as string) || 'user_aman_in';
  return db.findUserById(userId) || db.getUsers()[0];
};

// ================= AUTH & USER PERSONAS =================
apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const profile = db.findProfileByUserId(user.id);
  const verification = db.findVerificationByUserId(user.id);

  res.json({
    user,
    profile,
    verification,
    allUsers: db.getUsers().map((u) => {
      const p = db.findProfileByUserId(u.id);
      return { id: u.id, email: u.email, role: u.role, name: `${p?.legalFirstName || ''} ${p?.legalLastName || ''}`.trim() };
    }),
  });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email } = req.body;
  const user = db.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const profile = db.findProfileByUserId(user.id);
  const verification = db.findVerificationByUserId(user.id);
  res.json({ user, profile, verification, token: `mock_jwt_${user.id}` });
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { email, legalFirstName, legalLastName, country } = req.body;
  if (!email || !legalFirstName || !legalLastName || !country) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const existing = db.findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const userId = `user_${Date.now()}`;
  const newUser: User = {
    id: userId,
    email,
    passwordHash: 'argon2id_mock_hashed_secret',
    role: 'SENDER',
    emailVerified: true,
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const newProfile: UserProfile = {
    id: `prof_${Date.now()}`,
    userId,
    legalFirstName,
    legalLastName,
    countryOfResidence: country,
    phoneNumber: '+1 555-0199',
    addressLine1: 'Main Street 101',
    city: 'Metropolis',
    state: 'State',
    postalCode: '10001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const newVerif: Verification = {
    id: `verif_${Date.now()}`,
    userId,
    tier: 'TIER_1_BASIC',
    status: 'VERIFIED',
    riskScore: 10,
    riskLevel: 'LOW',
    sanctionScreened: true,
    pepScreened: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.addUser(newUser, newProfile, newVerif);
  res.json({ user: newUser, profile: newProfile, verification: newVerif });
});

// Update KYC / verification
apiRouter.post('/auth/verify-kyc', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const { documentType, documentNumber, taxId, tier = 'TIER_2_ENHANCED' } = req.body;

  const verif = db.updateVerification(user.id, {
    tier,
    status: 'VERIFIED',
    idDocumentType: documentType,
    idDocumentNumber: documentNumber,
    verifiedAt: new Date().toISOString(),
  });

  const profile = db.findProfileByUserId(user.id);
  if (profile && taxId) {
    profile.taxIdNumber = taxId;
  }

  db.addAuditLog({
    userId: user.id,
    action: 'KYC_VERIFICATION_UPGRADED',
    entityType: 'Verification',
    entityId: verif?.id || user.id,
    details: { tier, documentType },
  });

  res.json({ success: true, verification: verif, profile });
});

// ================= CORRIDORS & RATES =================
apiRouter.get('/corridors', (_req: Request, res: Response) => {
  res.json({
    corridors: Object.values(CORRIDORS),
    networks: Object.values(SUPPORTED_NETWORKS),
    stablecoins: SUPPORTED_STABLECOINS,
    baseRates: BASE_FX_RATES,
  });
});

apiRouter.post('/quote', (req: Request, res: Response) => {
  try {
    const user = getUserFromReq(req);
    const { sourceCurrency, targetCurrency, sourceAmount, targetAmount, networkId, stablecoinSymbol } = req.body;

    if (!sourceCurrency || !targetCurrency) {
      return res.status(400).json({ error: 'sourceCurrency and targetCurrency are required' });
    }

    const quote = FXService.generateQuote({
      senderId: user.id,
      sourceCurrency,
      sourceAmount: sourceAmount ? Number(sourceAmount) : undefined,
      targetCurrency,
      targetAmount: targetAmount ? Number(targetAmount) : undefined,
      networkId,
      stablecoinSymbol,
    });

    res.json(quote);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate quote';
    res.status(400).json({ error: message });
  }
});

// ================= RECIPIENTS =================
apiRouter.get('/recipients', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const recipients = db.getRecipientsBySenderId(user.id);
  res.json(recipients);
});

apiRouter.post('/recipients', (req: Request, res: Response) => {
  try {
    const user = getUserFromReq(req);
    const {
      fullName,
      email,
      phone,
      country,
      payoutMethod,
      relationship,
      bankName,
      accountNumber,
      routingNumber,
      ifscCode,
      iban,
      accountType = 'CHECKING',
    } = req.body;

    if (!fullName || !email || !country || !payoutMethod || !bankName || !accountNumber) {
      return res.status(400).json({ error: 'Missing mandatory recipient or banking details' });
    }

    // Validate banking details format according to corridor
    const validation = OfframpService.validateBankingDetails({
      country,
      payoutMethod,
      accountNumber,
      routingNumber,
      ifscCode,
      iban,
    });

    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    // Mask account number for safe display and store securely
    const rawAcc = accountNumber.replace(/\s+/g, '');
    const masked = `•••• •••• ${rawAcc.slice(-4)}`;

    const recipId = `recip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRecipient: Recipient = {
      id: recipId,
      senderId: user.id,
      fullName,
      email,
      phone,
      country,
      payoutMethod,
      relationship: relationship || 'Friend / Family',
      isVerified: true,
      bankAccount: {
        id: `bank_${Date.now()}`,
        recipientId: recipId,
        bankName,
        accountNumberMasked: masked,
        routingNumber,
        ifscCode,
        iban,
        accountType,
        currency: country === 'US' ? 'USD' : country === 'IN' ? 'INR' : country === 'GB' ? 'GBP' : 'EUR',
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };

    db.addRecipient(newRecipient);

    db.addAuditLog({
      userId: user.id,
      action: 'RECIPIENT_ADDED',
      entityType: 'Recipient',
      entityId: recipId,
      details: { fullName, country, payoutMethod, bankName },
    });

    res.json(newRecipient);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save recipient';
    res.status(400).json({ error: message });
  }
});

// ================= TRANSFERS =================
apiRouter.get('/transfers', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  let transfers = db.getTransfers();

  // If sender or recipient, filter by user
  if (user.role === 'SENDER') {
    transfers = transfers.filter((t) => t.senderId === user.id);
  } else if (user.role === 'RECIPIENT') {
    transfers = transfers.filter((t) => t.recipientUserId === user.id || t.recipient?.email === user.email);
  }

  // Populate recipient and sender profile
  const populated = transfers.map((t) => {
    const r = db.findRecipientById(t.recipientId);
    const p = db.findProfileByUserId(t.senderId);
    return { ...t, recipient: r, senderProfile: p };
  });

  res.json(populated);
});

apiRouter.get('/transfers/:id', (req: Request, res: Response) => {
  const transfer = db.findTransferById(req.params.id);
  if (!transfer) {
    return res.status(404).json({ error: 'Transfer not found' });
  }

  const r = db.findRecipientById(transfer.recipientId);
  const p = db.findProfileByUserId(transfer.senderId);
  res.json({ ...transfer, recipient: r, senderProfile: p });
});

apiRouter.post('/transfers', async (req: Request, res: Response) => {
  try {
    const user = getUserFromReq(req);
    const {
      quoteId,
      recipientId,
      idempotencyKey,
      purposeOfPayment = 'FAMILY_MAINTENANCE',
      senderNotes,
      paymentMethod = 'UPI',
      autoExecute = true,
    } = req.body;

    if (!quoteId || !recipientId) {
      return res.status(400).json({ error: 'quoteId and recipientId are required' });
    }

    // Idempotency check: if transfer with this key already exists, return existing
    if (idempotencyKey) {
      const existing = db.findTransferByIdempotencyKey(idempotencyKey);
      if (existing) {
        return res.json(existing);
      }
    }

    const quote = db.findQuoteById(quoteId);
    if (!quote) {
      return res.status(400).json({ error: 'Exchange quote expired or not found' });
    }

    // Check if quote expired
    if (new Date(quote.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Quote has expired. Please refresh the rate to continue.' });
    }

    const recipient = db.findRecipientById(recipientId);
    if (!recipient) {
      return res.status(400).json({ error: 'Recipient not found' });
    }

    const transferId = `trf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const transferNumber = `TRF-2026-${quote.sourceCurrency}-${quote.targetCurrency}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTransfer: Transfer = {
      id: transferId,
      transferNumber,
      senderId: user.id,
      recipientId: recipient.id,
      recipientUserId: recipient.linkedUserId,
      quoteId: quote.id,
      quote,
      status: 'AWAITING_FUNDING',
      idempotencyKey: idempotencyKey || `idem_${Date.now()}`,
      purposeOfPayment,
      senderNotes,
      sourceCurrency: quote.sourceCurrency,
      sourceAmount: quote.sourceAmount,
      targetCurrency: quote.targetCurrency,
      targetAmount: quote.targetAmount,
      stablecoinSymbol: quote.stablecoinSymbol,
      stablecoinAmount: quote.stablecoinAmount,
      networkId: quote.networkId,
      events: [
        {
          id: `evt_init_${Date.now()}`,
          transferId,
          previousStatus: null,
          newStatus: 'DRAFT',
          reason: 'Transfer initiated by sender',
          actorRole: 'SENDER',
          createdAt: new Date().toISOString(),
        },
        {
          id: `evt_quote_${Date.now()}`,
          transferId,
          previousStatus: 'DRAFT',
          newStatus: 'AWAITING_FUNDING',
          reason: `Guaranteed FX quote locked at 1 ${quote.sourceCurrency} = ${quote.guaranteedRate} ${quote.targetCurrency}`,
          actorRole: 'SYSTEM',
          createdAt: new Date().toISOString(),
        },
      ],
      fundingOrder: {
        id: `fo_${Date.now()}`,
        transferId,
        providerName: quote.sourceCurrency === 'INR' ? 'Razorpay UPI Direct' : 'Domestic Payment Rail',
        providerOrderId: `ord_${Date.now()}`,
        paymentMethod,
        amount: quote.sourceAmount,
        currency: quote.sourceCurrency,
        status: 'INITIATED',
        paymentDetails: `Method: ${paymentMethod}`,
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addTransfer(newTransfer);

    // If autoExecute requested in sandbox, launch the background lifecycle!
    if (autoExecute) {
      // Async execution: will progress state machine step by step
      TransferStateMachine.executeSandboxLifecycle(newTransfer.id, { stepDelayMs: 600 }).catch((e) =>
        console.error('Lifecycle error:', e)
      );
    }

    res.json(newTransfer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to initiate transfer';
    res.status(500).json({ error: message });
  }
});

// Admin or User actions on transfer
apiRouter.post('/transfers/:id/action', async (req: Request, res: Response) => {
  try {
    const user = getUserFromReq(req);
    const { action, notes } = req.body;
    const transferId = req.params.id;

    const transfer = db.findTransferById(transferId);
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

    if (action === 'RELEASE_COMPLIANCE_HOLD') {
      if (user.role !== 'ADMIN' && user.role !== 'COMPLIANCE_OFFICER') {
        return res.status(403).json({ error: 'Unauthorized: Compliance Officer role required' });
      }

      // Transition from COMPLIANCE_HOLD to CONVERSION_PENDING
      const updated = TransferStateMachine.transition({
        transferId,
        nextStatus: 'CONVERSION_PENDING',
        reason: `Compliance hold cleared by Officer ${user.email}. Notes: ${notes || 'Sanctions screening & source of funds verified.'}`,
        actorRole: 'COMPLIANCE_OFFICER',
        actorId: user.id,
      });

      if (updated.complianceCase) {
        updated.complianceCase.status = 'CLEARED';
        updated.complianceCase.resolvedAt = new Date().toISOString();
        updated.complianceCase.resolutionNotes = notes || 'Manual clearance';
      }

      // Continue the rest of the sandbox pipeline
      TransferStateMachine.executeSandboxLifecycle(transferId, { stepDelayMs: 600 }).catch(console.error);

      return res.json(updated);
    }

    if (action === 'CANCEL') {
      const updated = TransferStateMachine.transition({
        transferId,
        nextStatus: 'CANCELLED',
        reason: notes || 'Cancelled by user',
        actorRole: user.role,
        actorId: user.id,
      });
      return res.json(updated);
    }

    if (action === 'TRIGGER_LIFECYCLE') {
      // Manually step through the lifecycle
      const updated = await TransferStateMachine.executeSandboxLifecycle(transferId, { stepDelayMs: 300 });
      return res.json(updated);
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Action failed';
    res.status(400).json({ error: message });
  }
});

// ================= ADMIN & METRICS =================
apiRouter.get('/admin/metrics', (_req: Request, res: Response) => {
  const transfers = db.getTransfers();
  const totalVolumeUSD = transfers.reduce((acc, t) => acc + (t.stablecoinAmount || 0), 0);
  const completed = transfers.filter((t) => t.status === 'COMPLETED').length;
  const inReview = transfers.filter((t) => t.status === 'COMPLIANCE_HOLD' || t.status === 'MANUAL_REVIEW').length;
  const pending = transfers.filter((t) => ['AWAITING_FUNDING', 'FUNDED', 'CRYPTO_TRANSFER_PENDING', 'PAYOUT_PENDING'].includes(t.status)).length;
  const failed = transfers.filter((t) => ['CANCELLED', 'FUNDING_FAILED', 'CONVERSION_FAILED', 'PAYOUT_FAILED'].includes(t.status)).length;

  res.json({
    totalTransfers: transfers.length,
    totalVolumeUSD: Number(totalVolumeUSD.toFixed(2)),
    completedCount: completed,
    inReviewCount: inReview,
    pendingCount: pending,
    failedCount: failed,
    successRate: transfers.length ? Number(((completed / transfers.length) * 100).toFixed(1)) : 100,
    activeCorridors: 6,
    avgSettlementSeconds: 78,
  });
});

apiRouter.get('/admin/compliance-queue', (_req: Request, res: Response) => {
  const transfers = db.getTransfers().filter((t) => t.complianceCase && (t.status === 'COMPLIANCE_HOLD' || t.status === 'MANUAL_REVIEW'));
  res.json(transfers);
});

apiRouter.get('/admin/audit-logs', (_req: Request, res: Response) => {
  res.json(db.getAuditLogs(100));
});

apiRouter.post('/admin/reset-database', (_req: Request, res: Response) => {
  db.resetToSeed();
  res.json({ success: true, message: 'Database reset to default seed state' });
});

// ================= NOTIFICATIONS =================
apiRouter.get('/notifications', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  res.json(db.getNotificationsByUserId(user.id));
});

apiRouter.post('/notifications/:id/read', (req: Request, res: Response) => {
  db.markNotificationRead(req.params.id);
  res.json({ success: true });
});

// ================= WEBHOOKS =================
apiRouter.post('/webhooks/onramp', (req: Request, res: Response) => {
  const signature = req.headers['x-onramp-signature'] as string;
  const rawPayload = JSON.stringify(req.body);

  if (!OnrampService.verifyWebhookSignature(rawPayload, signature)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { event, transferId } = req.body;
  if (event === 'payment.captured' && transferId) {
    TransferStateMachine.executeSandboxLifecycle(transferId).catch(console.error);
  }

  res.json({ received: true });
});

// ================= AUTOMATED TESTS =================
apiRouter.get('/tests/run', async (_req: Request, res: Response) => {
  try {
    const results = await runAllTests();
    res.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Tests failed';
    res.status(500).json({ error: message });
  }
});
