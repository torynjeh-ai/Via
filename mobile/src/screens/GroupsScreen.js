import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import GlobalSearch from '../components/GlobalSearch';
import { getGroups } from '../api/groups';
import { colors, spacing, fontSize } from '../theme';

export default function GroupsScreen({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

  const load = async () => {
    try { const res = await getGroups(); setGroups(res.data); } catch {}
  };

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Groups</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.searchButton}>
            <Ionicons name="search" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('CreateGroup')}>
            <Ionicons name="add-circle" size={28} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={groups}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('GroupDetail', { id: item.id })}>
            <Card>
              <Text style={styles.name}>{item.name}</Text>
              {item.description && <Text style={styles.desc}>{item.description}</Text>}
              <View style={styles.row}>
                <Text style={styles.info}>{item.contribution_amount} XAF · {item.cycle}</Text>
                <Text style={styles.info}>{item.member_count}/{item.max_members} members</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No groups available</Text>}
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
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  name: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  desc: { fontSize: fontSize.sm, color: colors.subtext, marginBottom: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  info: { fontSize: fontSize.sm, color: colors.subtext },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: spacing.xl },
});
