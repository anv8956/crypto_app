import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight,
  Printer,
  FileText,
} from 'lucide-react';
import { Transfer, User } from '../../shared/types';
import { apiClient } from '../api';

interface TransferDetailModalProps {
  transfer: Transfer;
  currentUser: User | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const TransferDetailModal: React.FC<TransferDetailModalProps> = ({
  transfer,
  currentUser,
  onClose,
  onRefresh,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isActing, setIsActing] = useState(false);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleAdminAction = async (action: string) => {
    try {
      setIsActing(true);
      await apiClient.executeTransferAction(transfer.id, action, adminNotes);
      onRefresh();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsActing(false);
    }
  };

  const isComplianceHold = transfer.status === 'COMPLIANCE_HOLD' || transfer.status === 'MANUAL_REVIEW';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'COMPLIANCE_OFFICER';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center space-x-3">
              <span className="font-mono text-xs font-bold text-slate-400">{transfer.transferNumber}</span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  transfer.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : transfer.status === 'COMPLIANCE_HOLD'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                }`}
              >
                {transfer.status}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              {transfer.sourceCurrency} {transfer.sourceAmount.toLocaleString()} → ${transfer.targetAmount.toFixed(2)}{' '}
              {transfer.targetCurrency}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Print Receipt"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Compliance Alert if in Hold */}
          {isComplianceHold && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
              <div className="flex items-center space-x-2 font-bold text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Regulatory Compliance Hold Active</span>
              </div>
              <p className="text-slate-300">
                This transfer triggered the FinCEN Travel Rule verification threshold or requires commercial invoice validation before final payout.
              </p>
              {transfer.complianceCase && (
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-amber-500/20 space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span>Risk Score:</span>
                    <strong className="text-amber-400">{transfer.complianceCase.riskScore}/100 ({transfer.complianceCase.riskLevel})</strong>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Reasons: {transfer.complianceCase.flagReasons?.join('; ') || 'Threshold check'}
                  </div>
                </div>
              )}

              {/* Admin release action */}
              {isAdmin && (
                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between">
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Enter approval audit notes..."
                    className="w-2/3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    onClick={() => handleAdminAction('RELEASE_COMPLIANCE_HOLD')}
                    disabled={isActing}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Release & Settle
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sender & Beneficiary */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Parties & Routing</p>
              <div>
                <span className="text-slate-500 block">Sender (Originator)</span>
                <span className="font-semibold text-slate-200">
                  {transfer.senderProfile?.legalFirstName || 'Aman'} {transfer.senderProfile?.legalLastName || 'Sharma'} ({transfer.senderProfile?.countryOfResidence || 'IN'})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Beneficiary (Recipient)</span>
                <span className="font-semibold text-slate-200">
                  {transfer.recipient?.fullName || 'Rahul Patel'} ({transfer.recipient?.country || 'US'})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Payout Destination</span>
                <span className="font-mono text-slate-300">
                  {transfer.recipient?.bankAccount.bankName} - {transfer.recipient?.bankAccount.accountNumberMasked}
                </span>
              </div>
            </div>

            {/* Financials & Stablecoin Liquidity */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Conversion & Liquidity</p>
              <div className="flex justify-between">
                <span className="text-slate-500">Source Amount:</span>
                <span className="font-mono font-semibold text-slate-200">
                  {transfer.sourceCurrency} {transfer.sourceAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Stablecoin Minted:</span>
                <span className="font-mono font-bold text-indigo-400">
                  {transfer.stablecoinAmount} {transfer.stablecoinSymbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payout Amount:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  ${transfer.targetAmount.toFixed(2)} {transfer.targetCurrency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Purpose:</span>
                <span className="text-slate-300">{transfer.purposeOfPayment}</span>
              </div>
            </div>
          </div>

          {/* Blockchain Settlement Card */}
          {transfer.blockchainTx && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950/30 border border-indigo-500/20 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Verified Blockchain Settlement
                  </span>
                </div>
                <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{transfer.blockchainTx.confirmations} Confirmations (Finalized)</span>
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Network:</span>
                  <span className="text-slate-200">Polygon PoS Mainnet</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Token Contract (USDC):</span>
                  <span className="text-slate-300">{transfer.blockchainTx.tokenAddress}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Transaction Hash:</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-indigo-300">{transfer.blockchainTx.txHash.slice(0, 16)}...</span>
                    <button
                      onClick={() => copyHash(transfer.blockchainTx!.txHash)}
                      className="text-slate-400 hover:text-white"
                      title="Copy Hash"
                    >
                      {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={transfer.blockchainTx.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300"
                      title="View on PolygonScan"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Block Number:</span>
                  <span className="text-slate-200">#{transfer.blockchainTx.blockNumber.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Clearing / Payout Order Card */}
          {transfer.payoutOrder && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Local Bank Payout Clearing
                </span>
                <span className="font-semibold text-emerald-400">{transfer.payoutOrder.status}</span>
              </div>
              <div className="space-y-1 font-mono text-[11px] text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Clearing Rail:</span>
                  <span>{transfer.payoutOrder.providerName}</span>
                </div>
                {transfer.payoutOrder.fedReferenceNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fedwire / FedNow Reference:</span>
                    <span className="text-emerald-400 font-bold">{transfer.payoutOrder.fedReferenceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Credited To:</span>
                  <span>{transfer.payoutOrder.destinationBank} ({transfer.payoutOrder.accountNumberMasked})</span>
                </div>
              </div>
            </div>
          )}

          {/* Audit Events Timeline */}
          <div className="space-y-3">
            <p className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
              Transfer Lifecycle Audit Trail ({transfer.events?.length || 0} events)
            </p>
            <div className="space-y-2 border-l-2 border-slate-800 pl-4 ml-2">
              {transfer.events?.map((evt) => (
                <div key={evt.id} className="relative text-xs">
                  <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-emerald-500" />
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold text-slate-200 font-mono">{evt.newStatus}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">{evt.reason}</p>
                  <span className="text-[10px] text-slate-600 block mt-0.5">Actor: {evt.actorRole}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Idempotency Key: <code className="font-mono text-slate-400">{transfer.idempotencyKey.slice(0, 16)}...</code>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
