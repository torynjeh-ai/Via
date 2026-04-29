import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANGUAGES, useLanguage } from '../context/LanguageContext';
import { colors, spacing, fontSize } from '../theme';

export default function LanguagePicker({ compact = false }) {
  const { lang, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.id === lang) || LANGUAGES[0];

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, compact && styles.compact]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.flag}>{current.flag}</Text>
        {!compact && <Text style={styles.label}>{current.nativeLabel}</Text>}
        <Ionicons name="chevron-down" size={12} color={colors.subtext} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Choose Language</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={LANGUAGES}
            keyExtractor={l => l.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.option, lang === item.id && styles.optionActive]}
                onPress={() => { setLanguage(item.id); setOpen(false); }}
              >
                <Text style={styles.optFlag}>{item.flag}</Text>
                <View style={styles.optText}>
                  <Text style={styles.optNative}>{item.nativeLabel}</Text>
                  <Text style={styles.optLabel}>{item.label}</Text>
                </View>
                {lang === item.id && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.sm, paddingVertical: 7,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 10, backgroundColor: colors.white,
  },
  compact: { paddingHorizontal: 8, paddingVertical: 6 },
  flag: { fontSize: 18 },
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },

  modal: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionActive: { backgroundColor: colors.primaryLight },
  optFlag: { fontSize: 28 },
  optText: { flex: 1 },
  optNative: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  optLabel: { fontSize: fontSize.sm, color: colors.subtext, marginTop: 2 },
});
