import { BASE_FX_RATES, CORRIDORS, SUPPORTED_NETWORKS, SUPPORTED_STABLECOINS } from '../../shared/constants';
import { ExchangeQuote, FeeBreakdown } from '../../shared/types';
import { db } from '../db';

export class FXService {
  /**
   * Get live quote with fee breakdown and quote lock
   */
  public static generateQuote(params: {
    senderId: string;
    sourceCurrency: string;
    sourceAmount?: number;
    targetCurrency: string;
    targetAmount?: number;
    networkId?: string;
    stablecoinSymbol?: string;
  }): ExchangeQuote {
    const {
      senderId,
      sourceCurrency,
      sourceAmount,
      targetCurrency,
      targetAmount,
      networkId = 'polygon',
      stablecoinSymbol = 'USDC',
    } = params;

    const sourceRateUSD = BASE_FX_RATES[sourceCurrency] || 1;
    const targetRateUSD = BASE_FX_RATES[targetCurrency] || 1;

    // Rate: 1 Source Unit in Target Currency
    // e.g. source INR (86.42 per USD) -> target USD (1 per USD)
    // 1 INR = (1 / 86.42) = 0.011571 USD
    const marketRate = targetRateUSD / sourceRateUSD;
    const spreadPercent = 0.35; // 0.35% FX spread
    const guaranteedRate = Number((marketRate * (1 - spreadPercent / 100)).toFixed(6));

    let finalSourceAmount = 0;
    let finalTargetAmount = 0;

    if (sourceAmount && sourceAmount > 0) {
      finalSourceAmount = Number(sourceAmount.toFixed(2));
    } else if (targetAmount && targetAmount > 0) {
      finalTargetAmount = Number(targetAmount.toFixed(2));
      // calculate required source amount before fees
      finalSourceAmount = Number((finalTargetAmount / guaranteedRate).toFixed(2));
    } else {
      throw new Error('Either sourceAmount or targetAmount must be provided and greater than 0');
    }

    // Fee breakdown in Source Currency
    // Convert base fee amounts to source currency
    const onrampFee = Number((finalSourceAmount * 0.0035).toFixed(2)); // 0.35%
    const appFee = Number((Math.max(finalSourceAmount * 0.0025, 20)).toFixed(2)); // 0.25% min 20 INR / $0.50
    // Network fee: $0.01 on polygon converted to source currency
    const networkCostUSD = networkId === 'arbitrum' ? 0.05 : 0.01;
    const networkFee = Number((networkCostUSD * sourceRateUSD).toFixed(2));
    const offrampFee = Number((finalSourceAmount * 0.002).toFixed(2)); // 0.20%

    const totalFee = Number((onrampFee + appFee + networkFee + offrampFee).toFixed(2));
    const totalCharged = Number((finalSourceAmount + totalFee).toFixed(2));

    // Net source amount that actually gets converted
    const netConvertibleSource = finalSourceAmount;
    // In USD-pegged stablecoins (USDC/USDT), 1 Token = 1 USD
    const stablecoinAmount = Number(((netConvertibleSource / sourceRateUSD) * (1 - spreadPercent / 100)).toFixed(2));

    // Target amount recipient gets in target currency
    finalTargetAmount = Number((stablecoinAmount * targetRateUSD).toFixed(2));

    const fees: FeeBreakdown = {
      onrampFeeFiat: onrampFee,
      applicationFeeFiat: appFee,
      networkFeeFiat: networkFee,
      offrampFeeFiat: offrampFee,
      totalFeeFiat: totalFee,
      totalChargedFiat: totalCharged,
    };

    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const quoteReference = `QTE-${sourceCurrency}-${targetCurrency}-${Math.floor(100000 + Math.random() * 900000)}`;

    const quote: ExchangeQuote = {
      id: quoteId,
      quoteReference,
      senderId,
      sourceCurrency,
      sourceAmount: finalSourceAmount,
      targetCurrency,
      targetAmount: finalTargetAmount,
      stablecoinSymbol,
      stablecoinAmount,
      networkId,
      fxRateSourceToUSD: Number((1 / sourceRateUSD).toFixed(6)),
      marketRate,
      guaranteedRate,
      spreadPercent,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min lock
      createdAt: new Date().toISOString(),
      fees,
      estimatedDeliveryMinutes: 2, // Stablecoin rail delivers in 1-2 minutes
    };

    db.saveQuote(quote);
    return quote;
  }
}
