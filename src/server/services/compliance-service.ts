import { ComplianceCase, KycTier, RiskLevel } from '../../shared/types';
import { db } from '../db';

export interface ComplianceEvaluation {
  passed: boolean;
  requiresManualReview: boolean;
  riskScore: number;
  riskLevel: RiskLevel;
  flagReasons: string[];
  travelRuleStatus: 'PASSED' | 'EXEMPT' | 'INFO_REQUIRED';
}

export class ComplianceService {
  /**
   * Evaluate compliance for an upcoming transfer
   */
  public static evaluateTransfer(params: {
    userId: string;
    sourceCurrency: string;
    sourceAmount: number;
    targetCurrency: string;
    targetAmount: number;
    usdEquivalent: number;
    purposeOfPayment: string;
    recipientCountry: string;
  }): ComplianceEvaluation {
    const {
      userId,
      usdEquivalent,
      recipientCountry,
      purposeOfPayment,
    } = params;

    const verification = db.findVerificationByUserId(userId);
    const profile = db.findProfileByUserId(userId);

    const flagReasons: string[] = [];
    let riskScore = 10; // Baseline low risk score

    const tier: KycTier = verification?.tier || 'TIER_0_UNVERIFIED';

    // 1. Tier limit validation
    if (tier === 'TIER_0_UNVERIFIED') {
      flagReasons.push('User is unverified (Tier 0). Identity verification required before sending funds.');
      riskScore += 60;
    } else if (tier === 'TIER_1_BASIC' && usdEquivalent > 1000) {
      flagReasons.push('Amount exceeds Tier 1 Basic limit of $1,000 USD. Requires Tier 2 photo ID upgrade.');
      riskScore += 45;
    } else if (tier === 'TIER_2_ENHANCED' && usdEquivalent > 10000) {
      flagReasons.push('Amount exceeds Tier 2 Enhanced limit of $10,000 USD. Requires Tier 3 Proof of Source of Funds.');
      riskScore += 40;
    }

    // 2. FinCEN Travel Rule (> $3,000 USD threshold)
    let travelRuleStatus: 'PASSED' | 'EXEMPT' | 'INFO_REQUIRED' = 'EXEMPT';
    if (usdEquivalent >= 3000) {
      if (!profile?.taxIdNumber || !profile?.addressLine1) {
        travelRuleStatus = 'INFO_REQUIRED';
        flagReasons.push('FinCEN / FATF Travel Rule threshold ($3,000) reached: Complete originator physical address and tax ID required.');
        riskScore += 25;
      } else {
        travelRuleStatus = 'PASSED';
      }
    }

    // 3. Indian LRS & Commercial remittances check
    if (purposeOfPayment === 'COMMERCIAL_SERVICES' && usdEquivalent > 2500) {
      flagReasons.push('Commercial services cross-border remittance requires commercial invoice and service contract upload.');
      riskScore += 25;
    }

    // 4. Sanctions & high-risk jurisdiction checks (Simulated FATF blacklist)
    const sanctionedCountries = ['IR', 'KP', 'SY', 'CU', 'RU'];
    if (sanctionedCountries.includes(recipientCountry.toUpperCase())) {
      flagReasons.push(`Destination country ${recipientCountry} is subject to comprehensive international sanctions.`);
      riskScore = 99;
    }

    // Risk level classification
    let riskLevel: RiskLevel = 'LOW';
    if (riskScore >= 75) {
      riskLevel = 'CRITICAL';
    } else if (riskScore >= 50) {
      riskLevel = 'HIGH';
    } else if (riskScore >= 25) {
      riskLevel = 'MEDIUM';
    }

    const requiresManualReview = riskScore >= 50;
    const passed = riskScore < 50;

    return {
      passed,
      requiresManualReview,
      riskScore,
      riskLevel,
      flagReasons,
      travelRuleStatus,
    };
  }

  /**
   * Create or attach compliance case to transfer
   */
  public static createComplianceCase(transferId: string, evaluation: ComplianceEvaluation): ComplianceCase {
    const complianceCase: ComplianceCase = {
      id: `case_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      transferId,
      assignedOfficerId: 'user_admin_elena',
      riskScore: evaluation.riskScore,
      riskLevel: evaluation.riskLevel,
      flagReasons: evaluation.flagReasons,
      sanctionHit: evaluation.riskScore >= 90,
      travelRuleStatus: evaluation.travelRuleStatus,
      status: evaluation.requiresManualReview ? 'OPEN' : 'CLEARED',
      createdAt: new Date().toISOString(),
    };
    return complianceCase;
  }
}
