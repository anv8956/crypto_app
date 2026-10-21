import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  RefreshCw,
  Zap,
  ShieldCheck,
  TrendingUp,
  Clock,
  Sparkles,
  Info,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { CORRIDORS, SUPPORTED_NETWORKS, SUPPORTED_STABLECOINS } from '../../shared/constants';
import { ExchangeQuote } from '../../shared/types';
import { apiClient } from '../api';

interface FxCalculatorCardProps {
  onStartTransfer: (quote: ExchangeQuote) => void;
}

export const FxCalculatorCard: React.FC<FxCalculatorCardProps> = ({ onStartTransfer }) => {
  const [sourceCurrency, setSourceCurrency] = useState('INR');
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [sourceAmount, setSourceAmount] = useState<number>(10000);
  const [networkId, setNetworkId] = useState('polygon');
  const [quote, setQuote] = useState<ExchangeQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFeeDetails, setShowFeeDetails] = useState(false);

  const fetchLiveQuote = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getQuote({
        sourceCurrency,
        targetCurrency,
        sourceAmount,
        networkId,
        stablecoinSymbol: 'USDC',
      });
      setQuote(res);
    } catch (e) {
      console.error('Failed to get quote:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveQuote();
  }, [sourceCurrency, targetCurrency, sourceAmount, networkId]);

  const sourceCorridor = CORRIDORS[sourceCurrency === 'INR' ? 'IN' : sourceCurrency === 'USD' ? 'US' : sourceCurrency === 'GB' ? 'GB' : 'EU'] || CORRIDORS.IN;
  const targetCorridor = CORRIDORS[targetCurrency === 'USD' ? 'US' : targetCurrency === 'IN' ? 'IN' : targetCurrency === 'GB' ? 'GB' : 'EU'] || CORRIDORS.US;

  // Traditional bank wire comparison math
  const tradBankFeeUSD = 35.0; // SWIFT standard fee
  const tradMarkupUSD = quote ? Number((quote.targetAmount * 0.028).toFixed(2)) : 5.0;
  const tradDeliveryDays = '3 - 5 business days';

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Instant Cross-Border Calculator</h3>
            <p className="text-xs text-slate-400">Guaranteed real-time rate locked for 15 minutes</p>
          </div>
        </div>

        {/* Network & Stablecoin Rail Pill */}
        <div className="flex items-center space-x-2 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-300 font-medium">Rail:</span>
          <select
            value={networkId}
            onChange={(e) => setNetworkId(e.target.value)}
            className="bg-transparent text-emerald-400 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="polygon" className="bg-slate-900 text-white">Polygon (USDC · ~$0.01 gas)</option>
            <option value="arbitrum" className="bg-slate-900 text-white">Arbitrum (USDC · ~$0.05 gas)</option>
            <option value="base" className="bg-slate-900 text-white">Base (USDC · ~$0.03 gas)</option>
          </select>
        </div>
      </div>

      {/* Main Currency Inputs */}
      <div className="mt-6 space-y-4">
        {/* Source Currency Input */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>You Send (Local Currency)</span>
            <span>Min: ₹500 | Max: ₹500,000</span>
          </div>
          <div className="flex items-center justify-between">
            <input
              type="number"
              min="100"
              value={sourceAmount}
              onChange={(e) => setSourceAmount(Math.max(1, Number(e.target.value)))}
              className="w-3/5 bg-transparent text-2xl sm:text-3xl font-bold text-white focus:outline-none"
              placeholder="10,000"
            />
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2">
              <span className="text-lg">{sourceCorridor.flag}</span>
              <select
                value={sourceCurrency}
                onChange={(e) => setSourceCurrency(e.target.value)}
                className="bg-transparent font-bold text-white focus:outline-none cursor-pointer text-sm"
              >
                <option value="INR" className="bg-slate-900 text-white">INR (₹)</option>
                <option value="USD" className="bg-slate-900 text-white">USD ($)</option>
                <option value="EUR" className="bg-slate-900 text-white">EUR (€)</option>
                <option value="GBP" className="bg-slate-900 text-white">GBP (£)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Exchange Rate & Fee Badge */}
        <div className="flex items-center justify-between px-2 text-xs text-slate-400">
          <div className="flex items-center space-x-1.5 font-medium text-slate-300">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              1 {sourceCurrency} ={' '}
              <strong className="text-emerald-400 font-bold">
                {quote ? quote.guaranteedRate : '...'} {targetCurrency}
              </strong>
            </span>
          </div>
          <button
            onClick={() => setShowFeeDetails(!showFeeDetails)}
            className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
          >
            <span>Total Fees: {quote ? `${sourceCurrency} ${quote.fees.totalFeeFiat}` : '...'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFeeDetails ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expandable Fee Breakdown */}
        {showFeeDetails && quote && (
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2 text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Fiat On-Ramp Fee (UPI / IMPS):</span>
              <span className="font-mono">{sourceCurrency} {quote.fees.onrampFeeFiat}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Borderless Application Fee:</span>
              <span className="font-mono">{sourceCurrency} {quote.fees.applicationFeeFiat}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Blockchain Network Fee ({networkId.toUpperCase()}):</span>
              <span className="font-mono">{sourceCurrency} {quote.fees.networkFeeFiat}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Payout Clearing Fee (FedNow / ACH):</span>
              <span className="font-mono">{sourceCurrency} {quote.fees.offrampFeeFiat}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between font-semibold text-emerald-400">
              <span>Total Amount Deducted:</span>
              <span>{sourceCurrency} {quote.fees.totalChargedFiat}</span>
            </div>
          </div>
        )}

        {/* Target Currency Output */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950/90 to-emerald-950/30 border border-emerald-500/30">
          <div className="flex items-center justify-between text-xs text-emerald-400/90 mb-1.5 font-medium">
            <span>Recipient Gets (Guaranteed in Bank)</span>
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Arrives in ~2 minutes</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300">
              {loading ? (
                <span className="animate-pulse text-slate-500">Calculating...</span>
              ) : quote ? (
                `${targetCorridor.currencySymbol} ${quote.targetAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}`
              ) : (
                '--'
              )}
            </div>
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2">
              <span className="text-lg">{targetCorridor.flag}</span>
              <select
                value={targetCurrency}
                onChange={(e) => setTargetCurrency(e.target.value)}
                className="bg-transparent font-bold text-white focus:outline-none cursor-pointer text-sm"
              >
                <option value="USD" className="bg-slate-900 text-white">USD ($)</option>
                <option value="INR" className="bg-slate-900 text-white">INR (₹)</option>
                <option value="GBP" className="bg-slate-900 text-white">GBP (£)</option>
                <option value="EUR" className="bg-slate-900 text-white">EUR (€)</option>
              </select>
            </div>
          </div>
          {quote && (
            <p className="text-[11px] text-slate-400 mt-2">
              Converts to <strong>{quote.stablecoinAmount} USDC</strong> on {networkId.toUpperCase()} with 1:1 USD parity.
            </p>
          )}
        </div>
      </div>

      {/* Traditional Bank Comparison Box */}
      <div className="mt-5 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
        <div className="flex items-center justify-between text-slate-300 mb-2 font-medium">
          <span className="text-slate-400">Comparison with SWIFT Bank Wire:</span>
          <span className="text-emerald-400 font-bold">You save ~85% on fees</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
            <p className="font-bold text-emerald-400">Borderless Stablecoin</p>
            <p className="text-slate-300 mt-0.5">Fee: ~${quote ? (quote.fees.totalFeeFiat / 86.42).toFixed(2) : '0.45'}</p>
            <p className="text-slate-400">Speed: <strong>Under 2 minutes</strong></p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 opacity-80">
            <p className="font-bold text-slate-400">Traditional Bank Wire</p>
            <p className="text-slate-300 mt-0.5">Fee: ~${tradBankFeeUSD + tradMarkupUSD}</p>
            <p className="text-slate-400">Speed: {tradDeliveryDays}</p>
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div className="mt-6">
        <button
          onClick={() => quote && onStartTransfer(quote)}
          disabled={!quote || loading}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          <span>Send {sourceCurrency} {sourceAmount.toLocaleString()} Now</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
