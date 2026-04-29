import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TCBalance from '../components/TCBalance';
import WalletCode from '../components/WalletCode';
import { getWallet, getTransactions } from '../api/wallet';
import { colors, spacing, fontSize } from '../theme';

const TX_ICONS = { top_up: '⬆️', withdrawal: '⬇️', contribution: '💳', payout: '💰', transfer_in: '📥', transfer_out: '📤' };
const TX_LABELS = { top_up: 'Top Up', withdrawal: 'Withdrawal', contribution: 'Contribution', payout: 'Payout', transfer_in: 'Transfer In', transfer_out: 'Transfer Out' };
const CREDIT = new Set(['top_up', 'payout', 'transfer_in']);

export default function WalletScreen() {
  const navigation = useNavigation();
  const [wallet, setWallet] = useState(null);
  const [txs, setTxs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [w, t] = await Promise.all([getWallet(), getTransactions({ limit: 5 })]);
      setWallet(w.data);
      setTxs(t.data?.transactions || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const actions = [
    { label: 'Top Up', icon: '⬆️', screen: 'TopUp' },
    { label: 'Withdraw', icon: '⬇️', screen: 'Withdraw' },
    { label: 'Transfer', icon: '📤', screen: 'Transfer' },
    { label: 'History', icon: '📋', screen: 'TransactionHistory' },
  ];

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.title}>My Wallet</Text>

      <View style={styles.balanceCard}>
        <TCBalance tcBalance={wallet?.tc_balance ?? 0} rates={wallet?.rates ?? {}} />
      </View>

      <WalletCode walletCode={wallet?.wallet_code} />

      <View style={styles.actions}>
        {actions.map(a => (
          <TouchableOpacity key={a.screen} style={styles.actionBtn} onPress={() => navigation.navigate(a.screen)}>
            <Text style={styles.actionIcon}>{a.icon}</Text>
            <Text style={styles.actionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')}>
            <Text style={styles.viewAll}>View all →</Text>
          </TouchableOpacity>
        </View>
        {txs.length === 0 ? (
          <Text style={styles.empty}>No transactions yet</Text>
        ) : txs.map(tx => (
          <View key={tx.id} style={styles.txItem}>
            <Text style={styles.txIcon}>{TX_ICONS[tx.type] || '💱'}</Text>
            <View style={styles.txInfo}>
              <Text style={styles.txType}>{TX_LABELS[tx.type] || tx.type}</Text>
              <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.txAmount, CREDIT.has(tx.type) ? styles.credit : styles.debit]}>
              {CREDIT.has(tx.type) ? '+' : '-'}{Number(tx.tc_amount).toFixed(4)} TC
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  balanceCard: { backgroundColor: colors.white, borderRadius: 16, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: { flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, alignItems: 'center' },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  section: { backgroundColor: colors.white, borderRadius: 12, padding: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  viewAll: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.subtext, paddingVertical: spacing.md },
  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  txIcon: { fontSize: 22, marginRight: spacing.sm },
  txInfo: { flex: 1 },
  txType: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  txDate: { fontSize: fontSize.sm, color: colors.subtext },
  txAmount: { fontSize: fontSize.md, fontWeight: '700' },
  credit: { color: colors.success },
  debit: { color: colors.danger },
});
