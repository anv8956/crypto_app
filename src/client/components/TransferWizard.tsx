import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  Layers,
  Banknote,
  Send,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CORRIDORS, SUPPORTED_NETWORKS } from '../../shared/constants';
import { ExchangeQuote, Recipient, Transfer, TransferStatus } from '../../shared/types';
import { apiClient } from '../api';

interface TransferWizardProps {
  initialQuote?: ExchangeQuote | null;
  onClose: () => void;
  onSuccess: (transfer: Transfer) => void;
}

export const TransferWizard: React.FC<TransferWizardProps> = ({
  initialQuote,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<number>(initialQuote ? 3 : 1);
  const [sourceCurrency, setSourceCurrency] = useState('INR');
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [sourceAmount, setSourceAmount] = useState<number>(initialQuote ? initialQuote.sourceAmount : 10000);
  const [networkId, setNetworkId] = useState('polygon');
  const [quote, setQuote] = useState<ExchangeQuote | null>(initialQuote || null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [purposeOfPayment, setPurposeOfPayment] = useState<string>('FAMILY_MAINTENANCE');
  const [senderNotes, setSenderNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');

  // New recipient form state if creating on the fly
  const [isAddingNewRecipient, setIsAddingNewRecipient] = useState(false);
  const [newRecipName, setNewRecipName] = useState('');
  const [newRecipEmail, setNewRecipEmail] = useState('');
  const [newRecipBank, setNewRecipBank] = useState('');
  const [newRecipAccount, setNewRecipAccount] = useState('');
  const [newRecipRouting, setNewRecipRouting] = useState('');
  const [newRecipIfsc, setNewRecipIfsc] = useState('');

  // Active tracking state during and after execution
  const [createdTransfer, setCreatedTransfer] = useState<Transfer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(900); // 15 mins

  // Load recipients
  useEffect(() => {
    apiClient.getRecipients().then((data) => {
      setRecipients(data);
      if (data.length > 0 && !selectedRecipientId) {
        setSelectedRecipientId(data[0].id);
      }
    }).catch(console.error);
  }, []);

  // Countdown timer for quote lock
  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll transfer status if currently tracking in Step 7
  useEffect(() => {
    if (step === 7 && createdTransfer) {
      const poller = setInterval(async () => {
        try {
          const fresh = await apiClient.getTransferById(createdTransfer.id);
          setCreatedTransfer(fresh);
          if (fresh.status === 'COMPLETED') {
            clearInterval(poller);
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
            });
            setStep(8); // Receipt step
            onSuccess(fresh);
          } else if (fresh.status === 'COMPLIANCE_HOLD') {
            clearInterval(poller);
            setStep(8); // Display compliance hold explanation in receipt view
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 1000);
      return () => clearInterval(poller);
    }
  }, [step, createdTransfer]);

  // Request new quote
  const handleGenerateQuote = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const q = await apiClient.getQuote({
        sourceCurrency,
        targetCurrency,
        sourceAmount,
        networkId,
        stablecoinSymbol: 'USDC',
      });
      setQuote(q);
      setQuoteSecondsLeft(900);
      setStep(3); // Move to fee review
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to calculate quote';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Add new recipient on the fly
  const handleCreateNewRecipient = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const targetCountry = targetCurrency === 'USD' ? 'US' : targetCurrency === 'INR' ? 'IN' : 'GB';
      const payoutMethod = targetCurrency === 'USD' ? 'US_FEDNOW' : targetCurrency === 'INR' ? 'IN_IMPS' : 'UK_FPS';

      const recip = await apiClient.createRecipient({
        fullName: newRecipName,
        email: newRecipEmail,
        country: targetCountry,
        payoutMethod,
        relationship: 'Friend or Business Associate',
        bankName: newRecipBank,
        accountNumber: newRecipAccount,
        routingNumber: newRecipRouting || undefined,
        ifscCode: newRecipIfsc || undefined,
      });

      setRecipients([recip, ...recipients]);
      setSelectedRecipientId(recip.id);
      setIsAddingNewRecipient(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add recipient';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit and execute transfer
  const handleAuthorizeTransfer = async () => {
    if (!quote || !selectedRecipientId) return;

    try {
      setIsLoading(true);
      setErrorMessage('');

      const idempotencyKey = `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const transfer = await apiClient.createTransfer({
        quoteId: quote.id,
        recipientId: selectedRecipientId,
        idempotencyKey,
        purposeOfPayment,
        senderNotes,
        paymentMethod,
        autoExecute: true,
      });

      setCreatedTransfer(transfer);
      setStep(7); // Move to live settlement tracker
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to authorize transfer';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRecipient = recipients.find((r) => r.id === selectedRecipientId);
  const minutes = Math.floor(quoteSecondsLeft / 60);
  const seconds = quoteSecondsLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Wizard Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Step {step} of {step >= 7 ? 'Completed' : '6'}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs text-slate-400 font-mono">
                {step <= 2 && 'Corridor & Amount'}
                {step === 3 && 'Fee Breakdown & Lock'}
                {step === 4 && 'Recipient Selection'}
                {step === 5 && 'Compliance & Purpose'}
                {step === 6 && 'Review & Authorize'}
                {step === 7 && 'Settling on Blockchain'}
                {step === 8 && 'Transaction Receipt'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">Send Money Internationally</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-1">
          <div
            className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-1 transition-all duration-300"
            style={{ width: `${Math.min(100, (step / 8) * 100)}%` }}
          />
        </div>

        {/* Body Content */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1 & 2: Amount & Corridor Selection */}
          {(step === 1 || step === 2) && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <label className="text-xs text-slate-400 block mb-1">Sending From</label>
                  <select
                    value={sourceCurrency}
                    onChange={(e) => setSourceCurrency(e.target.value)}
                    className="w-full bg-transparent font-bold text-white focus:outline-none cursor-pointer text-sm"
                  >
                    <option value="INR" className="bg-slate-900">🇮🇳 India (INR - ₹)</option>
                    <option value="USD" className="bg-slate-900">🇺🇸 United States (USD - $)</option>
                    <option value="EUR" className="bg-slate-900">🇪🇺 Eurozone (EUR - €)</option>
                    <option value="GBP" className="bg-slate-900">🇬🇧 United Kingdom (GBP - £)</option>
                  </select>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <label className="text-xs text-slate-400 block mb-1">Delivering To</label>
                  <select
                    value={targetCurrency}
                    onChange={(e) => setTargetCurrency(e.target.value)}
                    className="w-full bg-transparent font-bold text-white focus:outline-none cursor-pointer text-sm"
                  >
                    <option value="USD" className="bg-slate-900">🇺🇸 United States (USD - $)</option>
                    <option value="INR" className="bg-slate-900">🇮🇳 India (INR - ₹)</option>
                    <option value="GBP" className="bg-slate-900">🇬🇧 United Kingdom (GBP - £)</option>
                    <option value="EUR" className="bg-slate-900">🇪🇺 Eurozone (EUR - €)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <label className="text-xs text-slate-400 block mb-1">Amount to send ({sourceCurrency})</label>
                <input
                  type="number"
                  value={sourceAmount}
                  onChange={(e) => setSourceAmount(Number(e.target.value))}
                  className="w-full bg-transparent text-3xl font-extrabold text-white focus:outline-none"
                  placeholder="10000"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-700/30 text-xs text-indigo-300 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">RBI & FinCEN Compliant Rail</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Converted automatically via 1:1 USD-pegged USDC on Polygon. No crypto wallet or gas fees required by recipient.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleGenerateQuote}
                  disabled={isLoading || sourceAmount <= 0}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Lock Guaranteed Rate</span>}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Fee Breakdown & Rate Lock */}
          {step === 3 && quote && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Rate Locked ({minutes}:{seconds < 10 ? `0${seconds}` : seconds})</span>
                  </span>
                  <span className="font-mono text-slate-500">Ref: {quote.quoteReference}</span>
                </div>
                <div className="flex items-baseline justify-between py-2 border-b border-slate-800">
                  <span className="text-sm text-slate-300">Recipient Receives:</span>
                  <span className="text-3xl font-extrabold text-white">
                    {quote.targetCurrency === 'USD' ? '$' : quote.targetCurrency} {quote.targetAmount.toFixed(2)}
                  </span>
                </div>
                <div className="pt-2 text-xs text-slate-400 flex justify-between">
                  <span>Guaranteed FX Rate:</span>
                  <span className="font-bold text-emerald-400">
                    1 {quote.sourceCurrency} = {quote.guaranteedRate} {quote.targetCurrency}
                  </span>
                </div>
              </div>

              {/* Transparent Itemized Fees */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2.5">
                <p className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">Fee Schedule & Settlement</p>
                <div className="flex justify-between text-slate-300">
                  <span>Transfer Principal:</span>
                  <span className="font-mono">{quote.sourceCurrency} {quote.sourceAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Domestic On-ramp (UPI / Banking):</span>
                  <span className="font-mono">+{quote.sourceCurrency} {quote.fees.onrampFeeFiat}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Borderless Remittance Fee:</span>
                  <span className="font-mono">+{quote.sourceCurrency} {quote.fees.applicationFeeFiat}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Polygon Blockchain Gas Fee:</span>
                  <span className="font-mono">+{quote.sourceCurrency} {quote.fees.networkFeeFiat}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>FedNow / Local Payout Clearing:</span>
                  <span className="font-mono">+{quote.sourceCurrency} {quote.fees.offrampFeeFiat}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-emerald-400 text-sm">
                  <span>Total Amount Charged:</span>
                  <span>{quote.sourceCurrency} {quote.fees.totalChargedFiat.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-sm hover:bg-slate-800"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center space-x-2"
                >
                  <span>Select Recipient</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Select or Add Recipient */}
          {step === 4 && (
            <div className="space-y-4">
              {!isAddingNewRecipient ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Select Saved Beneficiary</p>
                    <button
                      onClick={() => setIsAddingNewRecipient(true)}
                      className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
                    >
                      + Add New Recipient
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {recipients.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRecipientId(r.id)}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-colors ${
                          selectedRecipientId === r.id
                            ? 'bg-emerald-950/30 border-emerald-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-sm">{r.fullName}</p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
                            {r.country} • {r.payoutMethod}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {r.bankAccount.bankName} | {r.bankAccount.accountNumberMasked}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* Add New Recipient Form */
                <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <p className="text-xs font-bold text-emerald-400 uppercase">New Recipient Details</p>
                    <button
                      onClick={() => setIsAddingNewRecipient(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      value={newRecipName}
                      onChange={(e) => setNewRecipName(e.target.value)}
                      placeholder="e.g. Rahul Patel"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Email Address (for notification)</label>
                    <input
                      type="email"
                      value={newRecipEmail}
                      onChange={(e) => setNewRecipEmail(e.target.value)}
                      placeholder="rahul@example.com"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={newRecipBank}
                        onChange={(e) => setNewRecipBank(e.target.value)}
                        placeholder="JPMorgan Chase"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Account Number</label>
                      <input
                        type="text"
                        value={newRecipAccount}
                        onChange={(e) => setNewRecipAccount(e.target.value)}
                        placeholder="123456789"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                  {targetCurrency === 'USD' && (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">9-digit ABA Routing Number</label>
                      <input
                        type="text"
                        value={newRecipRouting}
                        onChange={(e) => setNewRecipRouting(e.target.value)}
                        placeholder="021000021"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  )}
                  {targetCurrency === 'INR' && (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">11-char IFSC Code</label>
                      <input
                        type="text"
                        value={newRecipIfsc}
                        onChange={(e) => setNewRecipIfsc(e.target.value)}
                        placeholder="HDFC0001234"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleCreateNewRecipient}
                    disabled={isLoading || !newRecipName || !newRecipAccount || !newRecipBank}
                    className="w-full mt-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                  >
                    Save & Select Recipient
                  </button>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-sm hover:bg-slate-800"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(5)}
                  disabled={!selectedRecipientId}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center space-x-2 disabled:opacity-50"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Purpose of Payment & Regulatory Disclosures */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <label className="text-xs text-slate-300 font-semibold block">Purpose of Remittance</label>
                <select
                  value={purposeOfPayment}
                  onChange={(e) => setPurposeOfPayment(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                >
                  <option value="FAMILY_MAINTENANCE">Family Maintenance / Living Expenses</option>
                  <option value="EDUCATION">Education / Tuition & Student Living</option>
                  <option value="GIFT_OR_DONATION">Personal Gift or Celebration</option>
                  <option value="COMMERCIAL_SERVICES">Commercial IT / Consulting Services (Requires Invoice)</option>
                  <option value="MEDICAL">Medical Treatment Abroad</option>
                </select>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Sender Note (Optional)</label>
                  <input
                    type="text"
                    value={senderNotes}
                    onChange={(e) => setSenderNotes(e.target.value)}
                    placeholder="e.g. Split for dinner & rent"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Regulatory Disclosure Box */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-700/30 text-xs text-indigo-200 space-y-1.5">
                <div className="flex items-center space-x-2 font-bold text-indigo-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Regulatory & Travel Rule Compliance</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Under the US FinCEN Travel Rule and Indian Foreign Exchange Management Act (FEMA), originator identity details and purpose are verified and safely retained in immutable audit logs.
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(4)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-sm hover:bg-slate-800"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(6)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center space-x-2"
                >
                  <span>Review Final Order</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Final Review & Confirmation */}
          {step === 6 && quote && selectedRecipient && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-3">
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Recipient:</span>
                  <span className="font-bold text-white">{selectedRecipient.fullName}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Delivering To:</span>
                  <span className="font-semibold text-slate-200">
                    {selectedRecipient.bankAccount.bankName} ({selectedRecipient.bankAccount.accountNumberMasked})
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Settlement Currency:</span>
                  <span className="font-bold text-emerald-400 text-base">
                    ${quote.targetAmount.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Total Charged to You:</span>
                  <span className="font-bold text-white text-base">
                    {quote.sourceCurrency} {quote.fees.totalChargedFiat.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Blockchain Rail:</span>
                  <span className="font-mono text-indigo-400">{quote.stablecoinAmount} USDC on Polygon PoS</span>
                </div>
              </div>

              {/* Payment Rail Selector */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <label className="text-xs text-slate-300 font-semibold block mb-2">Fund Transfer via:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`p-2.5 rounded-xl border text-xs text-left transition-colors cursor-pointer ${
                      paymentMethod === 'UPI'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    UPI / Instant QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('NET_BANKING')}
                    className={`p-2.5 rounded-xl border text-xs text-left transition-colors cursor-pointer ${
                      paymentMethod === 'NET_BANKING'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    NetBanking (IMPS/RTGS)
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(5)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-sm hover:bg-slate-800"
                >
                  Back
                </button>
                <button
                  onClick={handleAuthorizeTransfer}
                  disabled={isLoading}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-slate-950 font-extrabold text-sm flex items-center space-x-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Authorize Payment</span>}
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: Live State Machine Settlement Tracker */}
          {step === 7 && createdTransfer && (
            <div className="space-y-6 text-center py-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 animate-bounce">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Settling Cross-Border Rail</h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Transfer #{createdTransfer.transferNumber}
                </p>
              </div>

              {/* State Machine Steps */}
              <div className="max-w-md mx-auto space-y-3 text-left">
                {[
                  {
                    key: 'AWAITING_FUNDING',
                    label: '1. INR Payment Authorization',
                    desc: 'UPI instant debited from sender',
                  },
                  {
                    key: 'FUNDED',
                    label: '2. Payment Captured & Verified',
                    desc: 'Instant confirmation from on-ramp gateway',
                  },
                  {
                    key: 'COMPLIANCE_REVIEW',
                    label: '3. AML & Sanctions Automated Screening',
                    desc: 'OFAC SDN & India LRS check clean',
                  },
                  {
                    key: 'CRYPTO_TRANSFER_PENDING',
                    label: '4. USDC Minted & On-Chain Settlement',
                    desc: 'Dispatched to Polygon PoS Liquidity Pool',
                  },
                  {
                    key: 'PAYOUT_PENDING',
                    label: '5. FedNow Clearing Dispatch',
                    desc: 'Submitting USD credit to JPMorgan Chase',
                  },
                ].map((item, idx) => {
                  const isCurrent = createdTransfer.status === item.key;
                  const isPast = [
                    'FUNDED',
                    'COMPLIANCE_REVIEW',
                    'CONVERSION_PENDING',
                    'CRYPTO_TRANSFER_PENDING',
                    'CRYPTO_SETTLED',
                    'PAYOUT_PENDING',
                    'COMPLETED',
                  ].indexOf(createdTransfer.status) >= idx;

                  return (
                    <div
                      key={item.key}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isCurrent
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                          : isPast
                          ? 'bg-slate-950 border-slate-800 text-slate-300'
                          : 'bg-slate-950/40 border-slate-900 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        {isPast ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-700" />
                        )}
                        <div>
                          <p className="font-semibold">{item.label}</p>
                          <p className="text-[10px] text-slate-400">{item.desc}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono uppercase text-slate-500">
                        {isPast ? 'Done' : isCurrent ? 'Active' : 'Queued'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Status Note */}
              <div className="text-xs text-slate-400 animate-pulse">
                Current State: <strong className="text-emerald-400 font-mono">{createdTransfer.status}</strong>
              </div>
            </div>
          )}

          {/* STEP 8: Success Receipt View */}
          {step === 8 && createdTransfer && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white">Transfer Completed & Settled</h3>
                <p className="text-xs text-slate-400">
                  {createdTransfer.targetCurrency === 'USD' ? '$' : ''}
                  {createdTransfer.targetAmount.toFixed(2)} USD deposited into{' '}
                  {selectedRecipient?.fullName}'s bank account.
                </p>
              </div>

              {/* Receipt Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2.5">
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Transfer Number:</span>
                  <span className="font-mono font-bold text-white">{createdTransfer.transferNumber}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Amount Received:</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    ${createdTransfer.targetAmount.toFixed(2)} {createdTransfer.targetCurrency}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Recipient Bank:</span>
                  <span className="text-slate-200">
                    {selectedRecipient?.bankAccount.bankName} ({selectedRecipient?.bankAccount.accountNumberMasked})
                  </span>
                </div>

                {/* Blockchain Proof */}
                {createdTransfer.blockchainTx && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Blockchain Hash:</span>
                      <a
                        href={createdTransfer.blockchainTx.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-indigo-400 hover:underline flex items-center space-x-1"
                      >
                        <span>{createdTransfer.blockchainTx.txHash.slice(0, 10)}...</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Network & Block:</span>
                      <span className="font-mono text-slate-300">
                        Polygon PoS (Block #{createdTransfer.blockchainTx.blockNumber})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer"
                >
                  Done / Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
