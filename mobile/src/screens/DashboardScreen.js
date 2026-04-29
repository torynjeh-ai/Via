import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import GlobalSearch from '../components/GlobalSearch';
import { getMyGroups } from '../api/users';
import { getWallet } from '../api/wallet';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSize } from '../theme';

export default function DashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [groups, setGroups] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [wallet, setWallet] = useState(null);

  const load = async () => {
    try {
      const res = await getMyGroups();
      setGroups(res.data);
    } catch {}
    try { const w = await getWallet(); setWallet(w.data); } catch {}
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const statusColor = { forming: colors.warning, active: colors.success, completed: colors.subtext };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name} 👋</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.searchButton}>
            <Ionicons name="search" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut}>
            <Ionicons name="log-out-outline" size={26} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>My Groups</Text>
        <Text style={styles.balanceValue}>{groups.length}</Text>
      </Card>

      <TouchableOpacity style={styles.tcCard} onPress={() => navigation.navigate('Wallet')}>
        <View>
          <Text style={styles.tcLabel}>TC Balance</Text>
          <Text style={styles.tcValue}>{Number(wallet?.tc_balance ?? user?.tc_balance ?? 0).toFixed(2)} TC</Text>
          <Text style={styles.tcXaf}>≈ {((wallet?.tc_balance ?? user?.tc_balance ?? 0) * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })} XAF</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.white} />
      </TouchableOpacity>

      <View style={styles.row}>
        <Text style={styles.sectionTitle}>My Njangi Groups</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateGroup')}>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('GroupDetail', { id: item.id })}>
            <Card>
              <View style={styles.row}>
                <Text style={styles.groupName}>{item.name}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor[item.status] || colors.subtext }]}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.groupInfo}>{item.contribution_amount} XAF · {item.cycle}</Text>
              <Text style={styles.groupInfo}>Role: {item.my_role}</Text>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No groups yet. Create or join one!</Text>
        }
      />

      <GlobalSearch
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        navigation={navigation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchButton: { padding: spacing.xs },
  greeting: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  sub: { fontSize: fontSize.sm, color: colors.subtext },
  balanceCard: { backgroundColor: colors.primary, marginBottom: spacing.sm },
  tcCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, opacity: 0.9 },
  tcLabel: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  tcValue: { fontSize: fontSize.xl, fontWeight: '700', color: colors.white },
  tcXaf: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)' },
  balanceLabel: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.8)' },
  balanceValue: { fontSize: 40, fontWeight: '700', color: colors.white },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  groupName: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  groupInfo: { fontSize: fontSize.sm, color: colors.subtext, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: fontSize.sm, color: colors.white, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: spacing.xl },
});
