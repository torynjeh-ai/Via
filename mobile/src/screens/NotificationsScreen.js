import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import GlobalSearch from '../components/GlobalSearch';
import { getNotifications, markRead } from '../api/users';
import { colors, spacing, fontSize } from '../theme';

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

  const load = async () => {
    try { const res = await getNotifications(); setNotifications(res.data); } catch {}
  };

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleRead = async (id) => {
    await markRead(id);
    setNotifications((n) => n.map((item) => item.id === id ? { ...item, is_read: true } : item));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.searchButton}>
          <Ionicons name="search" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => !item.is_read && handleRead(item.id)}>
            <Card style={!item.is_read ? styles.unread : {}}>
              <View style={styles.row}>
                <View style={styles.dot} />
                <View style={styles.content}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <Text style={styles.message}>{item.message}</Text>
                  <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notifications yet</Text>}
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
  searchButton: { padding: spacing.xs },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  unread: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6, marginRight: spacing.sm },
  content: { flex: 1 },
  notifTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  message: { fontSize: fontSize.sm, color: colors.subtext, marginTop: 2 },
  time: { fontSize: fontSize.sm, color: colors.border, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: spacing.xl },
});
