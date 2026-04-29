import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getReceiptHistory } from '../api/receipts';
import { colors, spacing, fontSize } from '../theme';

export default function ReceiptsScreen() {
  const navigation = useNavigation();
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState('all');

  const load = async () => {
    try { const res = await getReceiptHistory(); setHistory(res.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = filter === 'all' ? history : history.filter(h => h.type === filter);

  const totalContributions = history.filter(h => h.type === 'contribution').reduce((s, h) => s + h.amount, 0);
  const totalPayouts       = history.filter(h => h.type === 'payout').reduce((s, h) => s + h.amount, 0);

  const handleView = (item) => {
    // Build a minimal receipt object to pass to ReceiptScreen
    const receipt = {
      receipt_type:   item.type,
      receipt_number: item.receipt_number,
      transaction_id: item.transaction_id,
      status:         'completed',
      issued_at:      item.date,
      member:         { name: '', phone: '' },
      group:          { name: item.group_name, cycle: item.group_cycle, member_count: 0 },
      ...(item.type === 'contribution' ? {
        payment: { amount: item.amount, currency: 'XAF', method: item.payment_method, cycle_number: item.cycle_number },
      } : {
        payout: { amount: item.amount, currency: 'XAF', position: item.position, payout_date: item.date },
      }),
    };
    navigation.navigate('Receipt', { receipt });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Receipts</Text>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryIcon}>💳</Text>
          <Text style={styles.summaryLabel}>Contributed</Text>
          <Text style={styles.summaryAmount}>{totalContributions.toLocaleString()} XAF</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryIcon}>💰</Text>
          <Text style={styles.summaryLabel}>Received</Text>
          <Text style={styles.summaryAmount}>{totalPayouts.toLocaleString()} XAF</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filters}>
        {[
          { key: 'all', label: 'All' },
          { key: 'contribution', label: 'Contributions' },
          { key: 'payout', label: 'Payouts' },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => handleView(item)}>
            <Text style={styles.itemIcon}>{item.type === 'contribution' ? '💳' : '💰'}</Text>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>
                {item.type === 'contribution' ? 'Contribution' : 'Payout'} — {item.group_name}
              </Text>
              <Text style={styles.itemMeta}>
                {item.receipt_number}
                {item.type === 'contribution' ? ` · Cycle #${item.cycle_number}` : ` · Position #${item.position}`}
              </Text>
              <Text style={styles.itemDate}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.itemRight}>
              <Text style={[styles.itemAmount, item.type === 'payout' && styles.payoutAmount]}>
                {item.type === 'payout' ? '+' : '-'}{item.amount.toLocaleString()} XAF
              </Text>
              <Text style={styles.viewHint}>🧾 View</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.empty}>Loading...</Text>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyTitle}>No receipts yet</Text>
              <Text style={styles.emptyText}>Your contribution and payout receipts will appear here</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  summary: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: { flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, alignItems: 'center' },
  summaryIcon: { fontSize: 24, marginBottom: 4 },
  summaryLabel: { fontSize: fontSize.sm, color: colors.subtext, marginBottom: 2 },
  summaryAmount: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },

  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  filterBtn: { flex: 1, padding: 8, borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, alignItems: 'center' },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: fontSize.sm, color: colors.subtext, fontWeight: '500' },
  filterTextActive: { color: colors.white },

  item: { backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  itemIcon: { fontSize: 28 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginBottom: 2 },
  itemMeta: { fontSize: 11, color: colors.subtext, fontFamily: 'monospace' },
  itemDate: { fontSize: fontSize.sm, color: colors.subtext, marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: fontSize.md, fontWeight: '700', color: colors.danger, marginBottom: 4 },
  payoutAmount: { color: colors.success },
  viewHint: { fontSize: 11, color: colors.primary, fontWeight: '600' },

  empty: { textAlign: 'center', color: colors.subtext, marginTop: spacing.xl },
  emptyWrap: { alignItems: 'center', marginTop: spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: fontSize.sm, color: colors.subtext, textAlign: 'center' },
});
