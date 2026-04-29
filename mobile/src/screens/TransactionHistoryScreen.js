import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { getTransactions } from '../api/wallet';
import { colors, spacing, fontSize } from '../theme';

const PAGE_SIZE = 50;
const TX_ICONS = { top_up: '⬆️', withdrawal: '⬇️', contribution: '💳', payout: '💰', transfer_in: '📥', transfer_out: '📤' };
const TX_LABELS = { top_up: 'Top Up', withdrawal: 'Withdrawal', contribution: 'Contribution', payout: 'Payout', transfer_in: 'Transfer In', transfer_out: 'Transfer Out' };
const CREDIT = new Set(['top_up', 'payout', 'transfer_in']);
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'top_up', label: '⬆️ Top Up' },
  { value: 'withdrawal', label: '⬇️ Withdraw' },
  { value: 'contribution', label: '💳 Contrib' },
  { value: 'payout', label: '💰 Payout' },
  { value: 'transfer_in', label: '📥 In' },
  { value: 'transfer_out', label: '📤 Out' },
];

export default function TransactionHistoryScreen() {
  const [txs, setTxs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p, f) => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset: p * PAGE_SIZE };
      if (f !== 'all') params.type = f;
      const res = await getTransactions(params);
      setTxs(res.data?.transactions || []);
      setTotal(res.data?.total || 0);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, filter); }, [page, filter, load]);

  const onRefresh = async () => { setRefreshing(true); await load(0, filter); setRefreshing(false); };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.value} style={[styles.filterBtn, filter === f.value && styles.filterActive]} onPress={() => { setFilter(f.value); setPage(0); }}>
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={txs}
        keyExtractor={i => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item: tx }) => (
          <View style={styles.item}>
            <Text style={styles.itemIcon}>{TX_ICONS[tx.type] || '💱'}</Text>
            <View style={styles.itemInfo}>
              <Text style={styles.itemType}>{TX_LABELS[tx.type] || tx.type}</Text>
              <Text style={styles.itemMeta}>
                {tx.counterparty_name ? `${tx.counterparty_name} · ` : ''}
                {new Date(tx.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.itemRight}>
              <Text style={[styles.itemAmount, CREDIT.has(tx.type) ? styles.credit : styles.debit]}>
                {CREDIT.has(tx.type) ? '+' : '-'}{Number(tx.tc_amount).toFixed(4)} TC
              </Text>
              <Text style={styles.itemXaf}>
                {Number(tx.xaf_amount || tx.tc_amount * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })} XAF
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading...' : 'No transactions found'}</Text>}
        ListFooterComponent={totalPages > 1 ? (
          <View style={styles.pagination}>
            <TouchableOpacity style={styles.pageBtn} onPress={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              <Text style={styles.pageBtnText}>← Prev</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>{page + 1} / {totalPages}</Text>
            <TouchableOpacity style={styles.pageBtn} onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <Text style={styles.pageBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 52 },
  filterBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.xs, backgroundColor: colors.white },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: fontSize.sm, color: colors.subtext },
  filterTextActive: { color: colors.white, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  itemIcon: { fontSize: 22, marginRight: spacing.sm },
  itemInfo: { flex: 1 },
  itemType: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  itemMeta: { fontSize: fontSize.sm, color: colors.subtext },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: fontSize.md, fontWeight: '700' },
  credit: { color: colors.success },
  debit: { color: colors.danger },
  itemXaf: { fontSize: fontSize.sm, color: colors.subtext },
  empty: { textAlign: 'center', color: colors.subtext, padding: spacing.xl },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  pageBtn: { padding: spacing.sm },
  pageBtnText: { color: colors.primary, fontWeight: '600' },
  pageInfo: { color: colors.subtext },
});
