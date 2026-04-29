import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { withdraw } from '../api/wallet';
import { colors, spacing, fontSize } from '../theme';

const METHODS = [
  { value: 'mtn_momo', label: '📱 MTN MoMo' },
  { value: 'orange_money', label: '🟠 Orange Money' },
  { value: 'bank_transfer', label: '🏦 Bank Transfer' },
  { value: 'card', label: '💳 Card' },
];

export default function WithdrawScreen({ navigation }) {
  const [tcAmount, setTcAmount] = useState('');
  const [method, setMethod] = useState('mtn_momo');
  const [phone, setPhone] = useState('');
  const [accountDetails, setAccountDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const xafPreview = tcAmount && Number(tcAmount) >= 0.01
    ? (Number(tcAmount) * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;
  const needsPhone = method === 'mtn_momo' || method === 'orange_money';

  const buildDest = () => {
    const d = { method };
    if (needsPhone) d.phone = phone;
    else if (method === 'bank_transfer') d.account_details = accountDetails;
    else if (method === 'card') d.card_details = accountDetails;
    return d;
  };

  const handleSubmit = async () => {
    const amount = Number(tcAmount);
    if (!amount || amount < 0.01) return Alert.alert('Error', 'Minimum withdrawal is 0.01 TC');
    setLoading(true);
    try {
      await withdraw({ tc_amount: amount, destination: buildDest() });
      Alert.alert('Success', `${amount.toFixed(4)} TC withdrawn successfully`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      if (e.limitType) {
        Alert.alert('Limit Exceeded', `${e.message}\n\nResets: ${e.resetsAt ? new Date(e.resetsAt).toLocaleString() : 'N/A'}`);
      } else {
        Alert.alert('Error', e.message || 'Withdrawal failed');
      }
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Withdraw TC</Text>
      <Text style={styles.hint}>Min 0.01 TC · Max 200 TC · 1 TC = 10,000 XAF</Text>

      <Text style={styles.label}>Amount (TC)</Text>
      <TextInput style={styles.input} value={tcAmount} onChangeText={setTcAmount} keyboardType="decimal-pad" placeholder="e.g. 1.0000" />
      {xafPreview && <Text style={styles.preview}>≈ {xafPreview} XAF</Text>}

      <Text style={styles.label}>Destination</Text>
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
      {(method === 'bank_transfer' || method === 'card') && (
        <>
          <Text style={styles.label}>{method === 'bank_transfer' ? 'Account Details' : 'Card Details'}</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={accountDetails} onChangeText={setAccountDetails} multiline placeholder={method === 'bank_transfer' ? 'Bank name, account number...' : 'Card number or reference'} />
        </>
      )}

      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Processing...' : `Withdraw${tcAmount ? ` ${Number(tcAmount).toFixed(4)} TC` : ''}`}</Text>
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
