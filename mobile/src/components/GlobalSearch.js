import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getGroups } from '../api/groups';
import { getNotifications } from '../api/users';
import { colors, spacing, fontSize } from '../theme';

const NAV_PAGES = [
  { label: 'Dashboard', screen: 'Home', icon: 'home', keywords: ['dashboard', 'home'] },
  { label: 'Groups', screen: 'Groups', icon: 'people', keywords: ['groups', 'njangi'] },
  { label: 'Notifications', screen: 'Notifications', icon: 'notifications', keywords: ['notifications', 'alerts'] },
  { label: 'Receipts', screen: 'Receipts', icon: 'receipt', keywords: ['receipts', 'history', 'payments'] },
  { label: 'Profile', screen: 'Profile', icon: 'person', keywords: ['profile', 'account'] },
];

export default function GlobalSearch({ visible, onClose, navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ groups: [], notifications: [], pages: [] });
  const [allGroups, setAllGroups] = useState([]);
  const [allNotifications, setAllNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, notificationsRes] = await Promise.all([
        getGroups().catch(() => ({ data: [] })),
        getNotifications().catch(() => ({ data: [] })),
      ]);
      setAllGroups(groupsRes.data || []);
      setAllNotifications(notificationsRes.data || []);
    } catch (error) {
      console.error('Error loading search data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults({ groups: [], notifications: [], pages: [] });
      return;
    }

    const q = query.toLowerCase();

    const groups = allGroups
      .filter(g => 
        g.name.toLowerCase().includes(q) || 
        g.description?.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const notifications = allNotifications
      .filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.message.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const pages = NAV_PAGES.filter(p => 
      p.label.toLowerCase().includes(q) || 
      p.keywords.some(k => k.includes(q))
    );

    setResults({ groups, notifications, pages });
  }, [query, allGroups, allNotifications]);

  const handleSelect = (type, item) => {
    setQuery('');
    onClose();
    Keyboard.dismiss();

    switch (type) {
      case 'page':
        navigation.navigate(item.screen);
        break;
      case 'group':
        navigation.navigate('GroupDetail', { id: item.id });
        break;
      case 'notification':
        navigation.navigate('Notifications');
        break;
    }
  };

  const handleClose = () => {
    setQuery('');
    onClose();
    Keyboard.dismiss();
  };

  const renderResultItem = ({ item, section }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelect(section, item)}
    >
      <View style={styles.resultIcon}>
        <Ionicons 
          name={section === 'page' ? item.icon : section === 'group' ? 'people' : 'notifications'} 
          size={20} 
          color={colors.primary} 
        />
      </View>
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>
          {section === 'page' ? item.label : item.name || item.title}
        </Text>
        {section === 'group' && (
          <Text style={styles.resultSubtitle}>
            {Number(item.contribution_amount).toLocaleString()} XAF · {item.cycle}
          </Text>
        )}
        {section === 'notification' && (
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {item.message}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (title, data, sectionType) => {
    if (data.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {data.map((item, index) => (
          <View key={`${sectionType}-${index}`}>
            {renderResultItem({ item, section: sectionType })}
          </View>
        ))}
      </View>
    );
  };

  const totalResults = results.groups.length + results.notifications.length + results.pages.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.subtext} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search groups, notifications, pages..."
              placeholderTextColor={colors.subtext}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={colors.subtext} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.centerContent}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : query.trim() === '' ? (
            <View style={styles.centerContent}>
              <Ionicons name="search" size={48} color={colors.subtext} />
              <Text style={styles.emptyTitle}>Search Via</Text>
              <Text style={styles.emptySubtitle}>Find groups, notifications, and pages</Text>
            </View>
          ) : totalResults === 0 ? (
            <View style={styles.centerContent}>
              <Ionicons name="search" size={48} color={colors.subtext} />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>Try a different search term</Text>
            </View>
          ) : (
            <FlatList
              data={[1]} // Dummy data to render sections
              renderItem={() => (
                <View>
                  {renderSection('Pages', results.pages, 'page')}
                  {renderSection('Groups', results.groups, 'group')}
                  {renderSection('Notifications', results.notifications, 'notification')}
                </View>
              )}
              keyExtractor={() => 'search-results'}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    padding: spacing.xs,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.subtext,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.subtext,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  resultSubtitle: {
    fontSize: fontSize.sm,
    color: colors.subtext,
    marginTop: 2,
  },
});