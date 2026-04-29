import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  FlatList, StyleSheet, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../theme';

export const COUNTRIES = [
  { code: 'CM', name: 'Cameroon',        dial: '+237', flag: '🇨🇲' },
  { code: 'NG', name: 'Nigeria',          dial: '+234', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana',            dial: '+233', flag: '🇬🇭' },
  { code: 'SN', name: 'Senegal',          dial: '+221', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire",    dial: '+225', flag: '🇨🇮' },
  { code: 'KE', name: 'Kenya',            dial: '+254', flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa',     dial: '+27',  flag: '🇿🇦' },
  { code: 'TZ', name: 'Tanzania',         dial: '+255', flag: '🇹🇿' },
  { code: 'UG', name: 'Uganda',           dial: '+256', flag: '🇺🇬' },
  { code: 'RW', name: 'Rwanda',           dial: '+250', flag: '🇷🇼' },
  { code: 'ET', name: 'Ethiopia',         dial: '+251', flag: '🇪🇹' },
  { code: 'EG', name: 'Egypt',            dial: '+20',  flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco',          dial: '+212', flag: '🇲🇦' },
  { code: 'TN', name: 'Tunisia',          dial: '+216', flag: '🇹🇳' },
  { code: 'DZ', name: 'Algeria',          dial: '+213', flag: '🇩🇿' },
  { code: 'CD', name: 'DR Congo',         dial: '+243', flag: '🇨🇩' },
  { code: 'AO', name: 'Angola',           dial: '+244', flag: '🇦🇴' },
  { code: 'MZ', name: 'Mozambique',       dial: '+258', flag: '🇲🇿' },
  { code: 'ZM', name: 'Zambia',           dial: '+260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe',         dial: '+263', flag: '🇿🇼' },
  { code: 'BJ', name: 'Benin',            dial: '+229', flag: '🇧🇯' },
  { code: 'BF', name: 'Burkina Faso',     dial: '+226', flag: '🇧🇫' },
  { code: 'ML', name: 'Mali',             dial: '+223', flag: '🇲🇱' },
  { code: 'NE', name: 'Niger',            dial: '+227', flag: '🇳🇪' },
  { code: 'TD', name: 'Chad',             dial: '+235', flag: '🇹🇩' },
  { code: 'GA', name: 'Gabon',            dial: '+241', flag: '🇬🇦' },
  { code: 'CG', name: 'Congo',            dial: '+242', flag: '🇨🇬' },
  { code: 'GN', name: 'Guinea',           dial: '+224', flag: '🇬🇳' },
  { code: 'TG', name: 'Togo',             dial: '+228', flag: '🇹🇬' },
  { code: 'MR', name: 'Mauritania',       dial: '+222', flag: '🇲🇷' },
  { code: 'GB', name: 'United Kingdom',   dial: '+44',  flag: '🇬🇧' },
  { code: 'FR', name: 'France',           dial: '+33',  flag: '🇫🇷' },
  { code: 'DE', name: 'Germany',          dial: '+49',  flag: '🇩🇪' },
  { code: 'US', name: 'United States',    dial: '+1',   flag: '🇺🇸' },
  { code: 'CA', name: 'Canada',           dial: '+1',   flag: '🇨🇦' },
  { code: 'IN', name: 'India',            dial: '+91',  flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil',           dial: '+55',  flag: '🇧🇷' },
  { code: 'AU', name: 'Australia',        dial: '+61',  flag: '🇦🇺' },
  { code: 'AE', name: 'UAE',              dial: '+971', flag: '🇦🇪' },
];

export default function PhoneInput({ label, onChangePhone }) {
  const [selected, setSelected] = useState(COUNTRIES[0]);
  const [number, setNumber] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search)
  );

  const handleSelect = (country) => {
    setSelected(country);
    setModalOpen(false);
    setSearch('');
    onChangePhone(`${country.dial}${number}`);
  };

  const handleNumberChange = (text) => {
    const digits = text.replace(/[^\d]/g, '');
    setNumber(digits);
    onChangePhone(`${selected.dial}${digits}`);
  };

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputRow}>
        {/* Country picker button */}
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setModalOpen(true)}>
          <Text style={styles.flag}>{selected.flag}</Text>
          <Text style={styles.dial}>{selected.dial}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.subtext} />
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Number input */}
        <TextInput
          style={styles.numberInput}
          placeholder=""
          placeholderTextColor={colors.subtext}
          keyboardType="phone-pad"
          value={number}
          onChangeText={handleNumberChange}
        />
      </View>

      {/* Country picker modal */}
      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => { setModalOpen(false); setSearch(''); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.subtext} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search country or code..."
              placeholderTextColor={colors.subtext}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.subtext} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={c => c.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.option, selected.code === item.code && styles.optionActive]}
                onPress={() => handleSelect(item)}
              >
                <Text style={styles.optionFlag}>{item.flag}</Text>
                <Text style={styles.optionName}>{item.name}</Text>
                <Text style={styles.optionDial}>{item.dial}</Text>
                {selected.code === item.code && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.noResult}>No countries found</Text>
            }
            keyboardShouldPersistTaps="handled"
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text, marginBottom: 6 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 13,
  },
  flag: { fontSize: 20 },
  dial: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  divider: { width: 1, height: 24, backgroundColor: colors.border },
  numberInput: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 13,
    fontSize: fontSize.md,
    color: colors.text,
  },

  // Modal
  modal: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: fontSize.md,
    color: colors.text,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  optionActive: { backgroundColor: colors.primaryLight },
  optionFlag: { fontSize: 22 },
  optionName: { flex: 1, fontSize: fontSize.md, color: colors.text },
  optionDial: { fontSize: fontSize.sm, color: colors.subtext, fontWeight: '500' },
  noResult: { textAlign: 'center', padding: spacing.xl, color: colors.subtext },
});
