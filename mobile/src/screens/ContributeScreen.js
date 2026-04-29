import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import Button from '../components/Button';
import { contribute } from '../api/groups';
import { getContributionReceipt } from '../api/receipts';
import { colors, spacing, fontSize } from '../theme';

const METHODS = [
  { key: 'mtn_momo', label: 'MTN Mobile Money', color: '#FFCC00' },
  { key: 'orange_money', label: 'Orange Money', color: '#FF6600' },
];

export default function ContributeScreen({ route, navigation }) {
  const { groupId, amount } = route.params;
  const [method, setMethod] = useState('mtn_momo');
  const [loading, setLoading] = useState(false);

  const handleContribute = async () => {
    setLoading(true);
    try {
      const res = await contribute(groupId, { payment_method: method });
      // Fetch receipt and navigate to it
      const receiptRes = await getContributionReceipt(res.data.contributionId);
      navigation.replace('Receipt', { receipt: receiptRes.data });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Make Contribution</Text>
      <Text style={styles.amount}>{Number(amount).toLocaleString()} XAF</Text>

      <Text style={styles.label}>Select Payment Method</Text>
      {METHODS.map((m) => (
        <TouchableOpacity
          key={m.key}
          style={[styles.methodCard, { borderColor: method === m.key ? m.color : colors.border, borderWidth: method === m.key ? 2 : 1 }]}
          onPress={() => setMethod(m.key)}
        >
          <View style={[styles.dot, { backgroundColor: m.color }]} />
          <Text style={styles.methodLabel}>{m.label}</Text>
          {method === m.key && <Text style={styles.check}>✓</Text>}
        </TouchableOpacity>
      ))}

      <Button title={`Pay ${Number(amount).toLocaleString()} XAF`} onPress={handleContribute} loading={loading} style={styles.btn} />
      <Button title="Cancel" onPress={() => navigation.goBack()} variant="outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  amount: { fontSize: 40, fontWeight: '700', color: colors.primary, marginBottom: spacing.xl },
  label: { fontSize: fontSize.md, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
  methodCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 12, backgroundColor: colors.white, marginBottom: spacing.sm },
  dot: { width: 16, height: 16, borderRadius: 8, marginRight: spacing.sm },
  methodLabel: { flex: 1, fontSize: fontSize.lg, color: colors.text },
  check: { fontSize: fontSize.lg, color: colors.success, fontWeight: '700' },
  btn: { marginTop: spacing.xl, marginBottom: spacing.sm },
});
