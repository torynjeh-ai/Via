import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import { getPayouts } from '../api/groups';
import { getPayoutReceipt } from '../api/receipts';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSize } from '../theme';

export default function PayoutsScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [payouts, setPayouts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingId, setLoadingId] = useState(null);

  const load = async () => {
    try { const res = await getPayouts(groupId); setPayouts(res.data); } catch {}
  };

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleViewReceipt = async (payout) => {
    if (payout.status !== 'completed') return;
    setLoadingId(payout.id);
    try {
      const res = await getPayoutReceipt(payout.id);
      navigation.navigate('Receipt', { receipt: res.data });
    } catch {
      Alert.alert('No Receipt', 'Receipt not available for this payout yet.');
    } finally {
      setLoadingId(null);
    }
  };

  const statusColor = {
    upcoming: colors.subtext,
    current: colors.primary,
    completed: colors.success,
    skipped: colors.danger,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payout Queue</Text>
      <FlatList
        data={payouts}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const isMyCompleted = item.user_id === user?.id && item.status === 'completed';
          return (
            <TouchableOpacity
              onPress={() => isMyCompleted && handleViewReceipt(item)}
              activeOpacity={isMyCompleted ? 0.7 : 1}
            >
              <Card style={item.user_id === user?.id ? styles.myCard : {}}>
                <View style={styles.row}>
                  <View style={[styles.position, { backgroundColor: statusColor[item.status] }]}>
                    <Text style={styles.posNum}>#{item.position}</Text>
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>
                      {item.name} {item.user_id === user?.id ? '(You)' : ''}
                    </Text>
                    <Text style={styles.sub}>
                      {Number(item.amount).toLocaleString()} XAF
                      {item.payout_date ? ` · ${new Date(item.payout_date).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <View style={[styles.badge, { backgroundColor: statusColor[item.status] }]}>
                      <Text style={styles.badgeText}>{item.status}</Text>
                    </View>
                    {isMyCompleted && (
                      <View style={styles.receiptHint}>
                        {loadingId === item.id
                          ? <Ionicons name="hourglass" size={14} color={colors.primary} />
                          : <Ionicons name="receipt-outline" size={14} color={colors.primary} />
                        }
                        <Text style={styles.receiptHintText}>Receipt</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No payout queue yet. Start the group first.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  myCard: { borderWidth: 2, borderColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center' },
  position: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  posNum: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
  info: { flex: 1 },
  name: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  sub: { fontSize: fontSize.sm, color: colors.subtext },
  right: { alignItems: 'flex-end', gap: 4 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: fontSize.sm, color: colors.white, fontWeight: '600' },
  receiptHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  receiptHintText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: spacing.xl },
});
