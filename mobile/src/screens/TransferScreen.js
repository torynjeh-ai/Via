import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { getTransferPreview, transfer } from '../api/wallet';
import TransferConfirm from '../components/TransferConfirm';
import { colors, spacing, fontSize } from '../theme';

export default function TransferScreen({ navigation }) {
  const [recipient, setRecipient] = useState('');
  const [tcAmount, setTcAmount] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);

  const xafPreview = tcAmount && Number(tcAmount) > 0
    ? (Number(tcAmount) * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;

  const handlePreview = async () => {
    if (!recipient.trim()) return Alert.alert('Error', 'Enter a recipient phone or wallet code');
    const amount = Number(tcAmount);
    if (!amount || amount <= 0) return Alert.alert('Error', 'Enter a valid TC amount');
    setPreviewError('');
    setPreviewLoading(true);
    setShowConfirm(true);
    try {
      const res = await getTransferPreview({ recipient_identifier: recipient.trim(), tc_amount: amount });
      setPreview(res.data);
    } catch (e) {
      setPreviewError(e.message || 'Could not load preview');
    } finally { setPreviewLoading(false); }
  };

  const handleConfirm = async () => {
    setTransferLoading(true);
    try {
      const res = await transfer({ recipient_identifier: recipient.trim(), tc_amount: Number(tcAmount) });
      setShowConfirm(false);
      Alert.alert('Success', `Sent ${Number(res.data.tc_amount).toFixed(4)} TC to ${res.data.recipient_name || 'recipient'}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      setShowConfirm(false);
      Alert.alert('Error', e.message || 'Transfer failed');
    } finally { setTransferLoading(false); }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Send TC</Text>
      <Text style={styles.hint}>Transfer TC by phone number or wallet code (VIA-XXXXX)</Text>

      <Text style={styles.label}>Recipient</Text>
      <TextInput style={styles.input} value={recipient} onChangeText={setRecipient} placeholder="Phone or VIA-XXXXX wallet code" autoCapitalize="characters" />

      <Text style={styles.label}>Amount (TC)</Text>
      <TextInput style={styles.input} value={tcAmount} onChangeText={setTcAmount} keyboardType="decimal-pad" placeholder="e.g. 1.0000" />
      {xafPreview && <Text style={styles.preview}>≈ {xafPreview} XAF</Text>}

      <TouchableOpacity style={styles.btn} onPress={handlePreview}>
        <Text style={styles.btnText}>Preview Transfer →</Text>
      </TouchableOpacity>

      <TransferConfirm
        visible={showConfirm}
        preview={preview}
        loading={previewLoading}
        error={previewError}
        onConfirm={handleConfirm}
        onCancel={() => { setShowConfirm(false); setPreview(null); setPreviewError(''); }}
      />
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
  btn: { marginTop: spacing.xl, backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { fontSize: fontSize.lg, fontWeight: '700', color: colors.white },
});
