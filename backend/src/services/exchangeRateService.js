/**
 * ExchangeRateService
 *
 * Fetches live fiat exchange rates and converts TC amounts to multiple currencies.
 * XAF is always computed from the fixed internal rate: 1 TC = 10,000 XAF.
 * Other currencies use live rates from exchangerate-api.com, cached for 60 minutes.
 */

const TC_TO_XAF = 10000; // 1 TC = 10,000 XAF (fixed, never changes)
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const SUPPORTED_CURRENCIES = ['XAF', 'USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES'];

// In-memory cache
let rateCache = {
  rates: null,   // { USD: x, EUR: x, GBP: x, NGN: x, GHS: x, KES: x } (XAF-based rates)
  fetchedAt: null,
};

/**
 * Fetch live exchange rates from external API.
 * Base currency is XAF. Returns rates relative to XAF.
 */
const fetchLiveRates = async () => {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  const baseUrl = process.env.EXCHANGE_RATE_API_URL || 'https://v6.exchangerate-api.com/v6';

  if (!apiKey) {
    throw new Error('EXCHANGE_RATE_API_KEY not configured');
  }

  const response = await fetch(`${baseUrl}/${apiKey}/latest/XAF`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Exchange rate API returned ${response.status}`);
  }

  const data = await response.json();
  if (data.result !== 'success') {
    throw new Error(`Exchange rate API error: ${data['error-type']}`);
  }

  // data.conversion_rates contains rates relative to XAF
  return {
    USD: data.conversion_rates.USD,
    EUR: data.conversion_rates.EUR,
    GBP: data.conversion_rates.GBP,
    NGN: data.conversion_rates.NGN,
    GHS: data.conversion_rates.GHS,
    KES: data.conversion_rates.KES,
  };
};

/**
 * Get exchange rates. Returns cached rates if within TTL.
 * On failure, returns last cached rates with stale: true.
 * If no cache exists, returns XAF-only with stale: true.
 *
 * @returns {{ USD, EUR, GBP, NGN, GHS, KES, stale: boolean }}
 */
const getRates = async () => {
  const now = Date.now();
  const isCacheValid = rateCache.rates && rateCache.fetchedAt && (now - rateCache.fetchedAt < CACHE_TTL_MS);

  if (isCacheValid) {
    return { ...rateCache.rates, stale: false };
  }

  try {
    const freshRates = await fetchLiveRates();
    rateCache = { rates: freshRates, fetchedAt: now };
    return { ...freshRates, stale: false };
  } catch (err) {
    // Return stale cache if available, otherwise return null rates
    if (rateCache.rates) {
      return { ...rateCache.rates, stale: true };
    }
    // No cache at all — return null rates with stale flag
    return { USD: null, EUR: null, GBP: null, NGN: null, GHS: null, KES: null, stale: true };
  }
};

/**
 * Convert a TC amount to all supported currencies.
 * XAF always uses the fixed 10,000 rate regardless of API state.
 *
 * @param {number} tcAmount
 * @returns {{ XAF, USD, EUR, GBP, NGN, GHS, KES, stale: boolean }}
 */
const convertTC = async (tcAmount) => {
  const xafAmount = tcAmount * TC_TO_XAF;
  const rates = await getRates();

  return {
    XAF: parseFloat(xafAmount.toFixed(2)),
    USD: rates.USD !== null ? parseFloat((xafAmount * rates.USD).toFixed(2)) : null,
    EUR: rates.EUR !== null ? parseFloat((xafAmount * rates.EUR).toFixed(2)) : null,
    GBP: rates.GBP !== null ? parseFloat((xafAmount * rates.GBP).toFixed(2)) : null,
    NGN: rates.NGN !== null ? parseFloat((xafAmount * rates.NGN).toFixed(2)) : null,
    GHS: rates.GHS !== null ? parseFloat((xafAmount * rates.GHS).toFixed(2)) : null,
    KES: rates.KES !== null ? parseFloat((xafAmount * rates.KES).toFixed(2)) : null,
    stale: rates.stale,
  };
};

/**
 * Clear the rate cache (useful for testing).
 */
const clearCache = () => {
  rateCache = { rates: null, fetchedAt: null };
};

module.exports = { getRates, convertTC, clearCache, TC_TO_XAF, SUPPORTED_CURRENCIES };
