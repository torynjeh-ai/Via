/**
 * useCurrency hook
 * Provides currency conversion utilities using rates from the wallet API.
 * 
 * Usage:
 *   const { format, symbol, currency } = useCurrency(rates, preferredCurrency);
 *   format(50000) → "4.97 USD" (or "50,000 XAF" if XAF preferred)
 */

const CURRENCY_SYMBOLS = {
  XAF: 'XAF', USD: '$', EUR: '€', GBP: '£',
  NGN: '₦', GHS: 'GH₵', KES: 'KSh',
};

// Decimal places per currency
const DECIMALS = {
  XAF: 0, USD: 2, EUR: 2, GBP: 2,
  NGN: 0, GHS: 2, KES: 0,
};

/**
 * Convert XAF amount to preferred currency.
 * rates are XAF-to-currency (e.g. rates.USD = 0.00082 means 1 XAF = 0.00082 USD)
 */
export function convertXAF(xafAmount, currency, rates) {
  if (!xafAmount) return 0;
  if (currency === 'XAF' || !rates || rates[currency] == null) return xafAmount;
  return xafAmount * rates[currency];
}

/**
 * Format an XAF amount in the user's preferred currency.
 */
export function formatCurrency(xafAmount, currency = 'XAF', rates = {}) {
  const amount = convertXAF(xafAmount, currency, rates);
  const decimals = DECIMALS[currency] ?? 2;
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  const formatted = Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  // Symbol placement: prefix for $, €, £, suffix for XAF, NGN, GHS, KES
  const prefixSymbols = new Set(['USD', 'EUR', 'GBP']);
  if (prefixSymbols.has(currency)) return `${sym}${formatted}`;
  return `${formatted} ${sym}`;
}

export function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency;
}
