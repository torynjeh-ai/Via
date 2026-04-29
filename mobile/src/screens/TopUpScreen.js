import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { topUp } from '../api/wallet';
import { colors, spacing, fontSize } from '../theme';

const METHODS = [
  { value: 'mtn_momo', label: '📱 MTN MoMo' },
  { value: 'orange_money', label: '🟠 Orange Money' },
  { value: 'bank_transfer', label: '🏦 Bank Transfer' },
  { value: 'card', label: '💳 Card' },
];

export default function TopUpScreen({ navigation }) {
  const [xafAmount, setXafAmount] = useState('');
  const [method, setMethod] = useState('mtn_momo');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const tcPreview = xafAmount && Number(xafAmount) >= 100
    ? (Number(xafAmount) / 10000).toFixed(4) : null;
  const needsPhone = method === 'mtn_momo' || method === 'orange_money';

  const handleSubmit = async () => {
    const amount = Number(xafAmount);
    if (!amount || amount < 100) return Alert.alert('Error', 'Minimum top-up is 100 XAF');
    setLoading(true);
    try {
      const res = await topUp({ xaf_amount: amount, payment_method: method, ...(needsPhone && phone ? { phone } : {}) });
      Alert.alert('Success', `Wallet credited with ${Number(res.data.tc_amount).toFixed(4)} TC`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) { Alert.alert('Error', e.message || 'Top-up failed'); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Top Up Wallet</Text>
      <Text style={styles.hint}>1 TC = 10,000 XAF · Minimum 100 XAF</Text>

      <Text style={styles.label}>Amount (XAF)</Text>
      <TextInput style={styles.input} value={xafAmount} onChangeText={setXafAmount} keyboardType="number-pad" placeholder="e.g. 10000" />
      {tcPreview && <Text style={styles.preview}>≈ {tcPreview} TC will be credited</Text>}

      <Text style={styles.label}>Payment Method</Text>
      <View style={styles.methodGrid}>
        {METHODS.map(m => (
          <TouchableOpacity key={m.value} style={[styles.methodBtn, method === m.value && styles.methodActive]} onPress={() => setMethod(m.value)}>
            <Text style={[styles.methodText, method === m.value && styles.methodTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {needsPhone && (
        <>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+237 6XX XXX XXX" />
        </>
      )}

      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Processing...' : `Top Up${xafAmount ? ` ${Number(xafAmount).toLocaleString()} XAF` : ''}`}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: 4 },
  hint: { fontSize: fontSize.sm, color: colors.subtext, marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text, marginBottom: 6, marginTop: spacing.sm },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, padding: spacing.sm, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.white },
  preview: { fontSize: fontSize.sm, color: colors.primary, marginTop: 4 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  methodBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white },
  methodActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodText: { fontSize: fontSize.sm, color: colors.text },
  methodTextActive: { color: colors.white, fontWeight: '600' },
  btn: { marginTop: spacing.xl, backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: fontSize.lg, fontWeight: '700', color: colors.white },
});
