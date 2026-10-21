import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Lock,
} from 'lucide-react';
import { Verification, UserProfile } from '../../shared/types';
import { apiClient } from '../api';

interface KycVerificationModalProps {
  verification: Verification | null;
  profile: UserProfile | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const KycVerificationModal: React.FC<KycVerificationModalProps> = ({
  verification,
  profile,
  onClose,
  onRefresh,
}) => {
  const [docType, setDocType] = useState('PASSPORT');
  const [docNumber, setDocNumber] = useState('');
  const [taxId, setTaxId] = useState(profile?.taxIdNumber || '');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const currentTier = verification?.tier || 'TIER_1_BASIC';

  const handleUpgradeTier = async () => {
    try {
      setIsUpgrading(true);
      await apiClient.verifyKyc({
        documentType: docType,
        documentNumber: docNumber || 'DEMO-KYC-90214',
        taxId: taxId || 'ABCPS9912F',
        tier: 'TIER_2_ENHANCED',
      });
      setSuccessMsg('Successfully upgraded to Tier 2 Enhanced ($10,000 limit).');
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Identity Verification & Tier Limits</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current Tier Status Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Current Verification:</span>
              <span className="font-bold text-emerald-400 font-mono">{currentTier}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Transaction Limit:</span>
              <span className="font-semibold text-white">
                {currentTier === 'TIER_1_BASIC'
                  ? 'Up to $1,000 / ₹80,000'
                  : currentTier === 'TIER_2_ENHANCED'
                  ? 'Up to $10,000 / ₹800,000'
                  : 'Unlimited (Institutional)'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">AML Risk Score:</span>
              <span className="font-mono text-emerald-400 font-bold">{verification?.riskScore ?? 10} / 100 (Low Risk)</span>
            </div>
          </div>

          {/* Tier Overview */}
          <div className="space-y-2">
            <p className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Verification Levels</p>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="font-semibold text-white">Tier 1: Basic</p>
                <p className="text-[11px] text-slate-400">Email & phone confirmed. Up to $1,000/transfer.</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="font-semibold text-white">Tier 2: Enhanced</p>
                <p className="text-[11px] text-slate-400">Government ID & Tax ID (PAN/SSN). Up to $10,000/transfer.</p>
              </div>
              {currentTier === 'TIER_2_ENHANCED' || currentTier === 'TIER_3_UNLIMITED' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <span className="text-[10px] text-indigo-400 font-semibold">Available</span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="font-semibold text-white">Tier 3: Unlimited</p>
                <p className="text-[11px] text-slate-400">Source of funds & bank statement proof. Over $10,000.</p>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold">Requires Bank Docs</span>
            </div>
          </div>

          {/* Upgrade form */}
          {currentTier === 'TIER_1_BASIC' && (
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-3">
              <p className="font-bold text-indigo-300">Upgrade to Tier 2 (Instant Verification)</p>
              <div>
                <label className="text-slate-400 block mb-1">ID Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENSE">Driver&apos;s License</option>
                  <option value="NATIONAL_ID">National ID / Aadhaar</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Tax ID / PAN / SSN</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="e.g. ABCPS1234F or XXX-XX-7842"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <button
                onClick={handleUpgradeTier}
                disabled={isUpgrading}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
              >
                {isUpgrading ? 'Verifying...' : 'Submit Verification Upgrade'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
