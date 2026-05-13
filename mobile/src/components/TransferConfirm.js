import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { colors, spacing, fontSize } from '../theme';

/**
 * TransferConfirm — bottom-sheet style modal for confirming a TC transfer.
 *
 * Props:
 *   visible      {boolean}  — controls Modal visibility
 *   preview      {object}   — transfer preview from getTransferPreview:
 *                             { recipient_name, tc_amount, fee_tc, total_tc,
 *                               amount_fiat, fee_fiat, total_fiat, has_shared_group }
 *                             Each *_fiat object: { XAF, USD, EUR, GBP, NGN, GHS, KES, stale }
 *   preferredCurrency {string} — user's preferred display currency (default 'XAF')
 *   loading      {boolean}  — show loading spinner while preview is fetching
 *   error        {string}   — error message to display
 *   onConfirm    {function} — called when user taps "Confirm Transfer"
 *   onCancel     {function} — called when user taps "Cancel" or closes modal
 */
export default function TransferConfirm({
  visible,
  preview,
  preferredCurrency = 'XAF',
  loading,
  error,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          <Text style={styles.title}>Confirm Transfer</Text>

          {/* ── Loading state ── */}
          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Calculating transfer details…</Text>
            </View>
          )}

          {/* ── Error state ── */}
          {!loading && !!error && (
            <View style={styles.center}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Normal breakdown ── */}
          {!loading && !error && !!preview && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Recipient */}
              <View style={styles.recipient}>
                <Text style={styles.recipientIcon}>👤</Text>
                <View>
                  <Text style={styles.recipientLabel}>Sending to</Text>
                  <Text style={styles.recipientName}>
                    {preview.recipient_name || 'Recipient'}
                  </Text>
                </View>
                {preview.has_shared_group && (
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>Free</Text>
                  </View>
                )}
              </View>

              {/* Fee breakdown */}
              <View style={styles.breakdown}>
                <Row
                  label="You send"
                  tcValue={preview.tc_amount}
                  fiatObj={preview.amount_fiat}
                  preferredCurrency={preferredCurrency}
                />

                <Row
                  label="Transfer fee"
                  tcValue={preview.fee_tc}
                  fiatObj={preview.fee_fiat}
                  preferredCurrency={preferredCurrency}
                  isFee
                />

                <View style={styles.divider} />

                <Row
                  label="Total deducted"
                  tcValue={preview.total_tc}
                  fiatObj={preview.total_fiat}
                  preferredCurrency={preferredCurrency}
                  bold
                />

                <Row
                  label="Recipient gets"
                  tcValue={preview.tc_amount}
                  fiatObj={preview.amount_fiat}
                  preferredCurrency={preferredCurrency}
                  isCredit
                />
              </View>

              {/* Stale rates warning */}
              {(preview.total_fiat?.stale ||
                preview.amount_fiat?.stale ||
                preview.fee_fiat?.stale) && (
                <Text style={styles.staleWarning}>
                  ⚠️ Exchange rates may be outdated
                </Text>
              )}

              {/* Action buttons */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
                  <Text style={styles.confirmBtnText}>Confirm Transfer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/**
 * A single breakdown row showing TC amount + fiat equivalents.
 *
 * @param {string}  label            — row label
 * @param {number}  tcValue          — TC amount to display
 * @param {object}  fiatObj          — { XAF, USD, EUR, … } from convertTC
 * @param {string}  preferredCurrency — user's preferred currency
 * @param {boolean} bold             — render values in bold
 * @param {boolean} isFee            — style as fee (green if free, normal otherwise)
 * @param {boolean} isCredit         — style value in green
 */
function Row({ label, tcValue, fiatObj = {}, preferredCurrency, bold, isFee, isCredit }) {
  const tc = Number(tcValue);
  const isFree = isFee && tc === 0;

  // Preferred currency fiat value (fall back to XAF)
  const prefCur = preferredCurrency || 'XAF';
  const prefValue = fiatObj[prefCur] ?? fiatObj['XAF'];
  const showPref = prefValue != null;

  // Always show XAF if preferred currency is not XAF
  const xafValue = fiatObj['XAF'];
  const showXaf = xafValue != null && prefCur !== 'XAF';

  const tcText = isFree ? 'Free' : `${tc.toFixed(4)} TC`;
  const tcStyle = [
    styles.rowValue,
    bold && styles.bold,
    isFree && styles.free,
    isCredit && styles.credit,
  ];

  return (
    <View style={styles.rowContainer}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={tcStyle}>{tcText}</Text>
      </View>

      {/* Fiat equivalents */}
      {!isFree && (showPref || showXaf) && (
        <View style={styles.fiatRow}>
          {showPref && (
            <Text style={styles.fiatText}>
              ≈{' '}
              {formatFiat(prefValue, prefCur)}
            </Text>
          )}
          {showXaf && (
            <Text style={styles.fiatText}>
              ≈{' '}
              {formatFiat(xafValue, 'XAF')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Format a fiat value with currency symbol/code.
 */
function formatFiat(value, currency) {
  const num = Number(value);
  const SYMBOLS = {
    XAF: 'XAF',
    USD: '$',
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    GHS: 'GH₵',
    KES: 'KSh',
  };
  const symbol = SYMBOLS[currency] || currency;
  const decimals = currency === 'XAF' ? 0 : 2;
  const formatted = num.toLocaleString(undefined, { maximumFractionDigits: decimals });

  // For currencies with prefix symbols, put symbol before number
  if (['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES'].includes(currency)) {
    return `${symbol}${formatted}`;
  }
  return `${formatted} ${symbol}`;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },

  // Loading / error
  center: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.subtext,
    fontSize: fontSize.md,
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: fontSize.md,
  },

  // Recipient card
  recipient: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  recipientIcon: {
    fontSize: 28,
    marginRight: spacing.xs,
  },
  recipientLabel: {
    fontSize: fontSize.sm,
    color: colors.subtext,
  },
  recipientName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  freeBadge: {
    marginLeft: 'auto',
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 20,
  },
  freeBadgeText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '700',
  },

  // Breakdown rows
  breakdown: {
    marginBottom: spacing.sm,
  },
  rowContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: colors.subtext,
    flex: 1,
  },
  rowValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  bold: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  free: {
    color: colors.success,
  },
  credit: {
    color: colors.success,
  },
  fiatRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: 2,
  },
  fiatText: {
    fontSize: fontSize.sm,
    color: colors.subtext,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },

  // Stale warning
  staleWarning: {
    fontSize: fontSize.sm,
    color: colors.warning,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    padding: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.subtext,
  },
  confirmBtn: {
    flex: 2,
    padding: 13,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.white,
  },
});
