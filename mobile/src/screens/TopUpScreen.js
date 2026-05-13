import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { topUp } from '../api/wallet';
import { colors, spacing, fontSize } from '../theme';

const PAYMENT_METHODS = [
  { value: 'mtn_momo',      label: '📱 MTN MoMo' },
  { value: 'orange_money',  label: '🟠 Orange Money' },
  { value: 'bank_transfer', label: '🏦 Bank Transfer' },
  { value: 'card',          label: '💳 Card' },
];

const NEEDS_PHONE = new Set(['mtn_momo', 'orange_money']);

export default function TopUpScreen() {
  const navigation = useNavigation();

  const [xafAmount, setXafAmount]   = useState('');
  const [method, setMethod]         = useState('mtn_momo');
  const [phone, setPhone]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(null);   // { tc_amount, new_balance }
  const [error, setError]           = useState('');

  const needsPhone = NEEDS_PHONE.has(method);

  // Live TC preview — shown as user types
  const parsedAmount = Number(xafAmount);
  const tcPreview =
    xafAmount !== '' && parsedAmount >= 100
      ? (parsedAmount / 10000).toFixed(4)
      : null;

  const handleSubmit = async () => {
    setError('');
    setSuccess(null);

    if (!xafAmount || parsedAmount < 100) {
      setError('Minimum top-up amount is 100 XAF.');
      return;
    }

    setLoading(true);
    try {
      const res = await topUp({
        xaf_amount: parsedAmount,
        payment_method: method,
        ...(needsPhone && phone ? { phone } : {}),
      });

      const data = res.data?.data ?? res.data ?? {};
      setSuccess({
        tc_amount:   Number(data.tc_amount   ?? data.tc_credited ?? 0),
        new_balance: Number(data.new_balance ?? 0),
      });
      setXafAmount('');
      setPhone('');
    } catch (e) {
      const msg =
        e.response?.data?.message ||
        e.message ||
        'Top-up failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => navigation.goBack();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.title}>Top Up Wallet</Text>
        <Text style={styles.subtitle}>1 TC = 10,000 XAF · Minimum 100 XAF</Text>

        {/* Success banner */}
        {success && (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✅</Text>
            <View style={styles.bannerBody}>
              <Text style={styles.successTitle}>Top-up successful!</Text>
              <Text style={styles.successText}>
                Credited{' '}
                <Text style={styles.bold}>{success.tc_amount.toFixed(4)} TC</Text>
                {'\n'}New balance:{' '}
                <Text style={styles.bold}>{success.new_balance.toFixed(4)} TC</Text>
              </Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
                <Text style={styles.doneBtnText}>Back to Wallet</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error banner */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Form — hidden after success */}
        {!success && (
          <>
            {/* XAF Amount */}
            <Text style={styles.label}>Amount (XAF)</Text>
            <TextInput
              style={styles.input}
              value={xafAmount}
              onChangeText={(v) => {
                setXafAmount(v);
                setError('');
              }}
              keyboardType="number-pad"
              placeholder="e.g. 10000"
              placeholderTextColor={colors.subtext}
              returnKeyType="done"
            />
            {tcPreview ? (
              <Text style={styles.preview}>≈ {tcPreview} TC will be credited</Text>
            ) : (
              xafAmount !== '' && parsedAmount < 100 && (
                <Text style={styles.previewWarn}>Minimum amount is 100 XAF</Text>
              )
            )}

            {/* Payment Method */}
            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.methodGrid}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[
                    styles.methodBtn,
                    method === m.value && styles.methodActive,
                  ]}
                  onPress={() => {
                    setMethod(m.value);
                    setPhone('');
                    setError('');
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.methodText,
                      method === m.value && styles.methodTextActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Phone number — only for MoMo methods */}
            {needsPhone && (
              <>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+237 6XX XXX XXX"
                  placeholderTextColor={colors.subtext}
                  returnKeyType="done"
                />
              </>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>
                {loading
                  ? 'Processing…'
                  : `Top Up${xafAmount ? ` ${parsedAmount.toLocaleString()} XAF` : ''}`}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },

  // Header
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.subtext,
    marginBottom: spacing.lg,
  },

  // Success banner
  successBanner: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success,
    gap: spacing.sm,
  },
  successIcon: {
    fontSize: 22,
  },
  bannerBody: {
    flex: 1,
  },
  successTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 4,
  },
  successText: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  doneBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  doneBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3F3',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  errorIcon: {
    fontSize: 18,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.danger,
  },

  // Form fields
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.white,
  },
  preview: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginTop: 4,
    fontWeight: '500',
  },
  previewWarn: {
    fontSize: fontSize.sm,
    color: colors.warning,
    marginTop: 4,
  },

  // Payment method grid
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  methodBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  methodActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  methodTextActive: {
    color: colors.white,
    fontWeight: '700',
  },

  // Submit button
  submitBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.white,
  },
});
