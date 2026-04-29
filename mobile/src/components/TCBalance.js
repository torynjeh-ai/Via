import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../theme';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES'];
const SYMBOLS = { XAF: 'XAF', USD: '$', EUR: '€', GBP: '£', NGN: '₦', GHS: 'GH₵', KES: 'KSh' };

export default function TCBalance({ tcBalance = 0, rates = {} }) {
  const [idx, setIdx] = useState(0);
  const xaf = (tcBalance * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const cur = CURRENCIES[idx];
  const rate = rates[cur];
  const converted = rate != null
    ? (tcBalance * 10000 * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '—';

  return (
    <View style={styles.container}>
      {rates.stale && (
        <Text style={styles.stale}>⚠️ Rates may be outdated</Text>
      )}
      <Text style={styles.tc}>{Number(tcBalance).toFixed(2)} TC</Text>
      <Text style={styles.xaf}>≈ {xaf} XAF</Text>
      <TouchableOpacity style={styles.toggle} onPress={() => setIdx(i => (i + 1) % CURRENCIES.length)}>
        <Text style={styles.toggleText}>{SYMBOLS[cur]} {converted} · tap to change</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.md },
  stale: { fontSize: fontSize.sm, color: colors.warning, marginBottom: spacing.xs },
  tc: { fontSize: 40, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
  xaf: { fontSize: fontSize.md, color: colors.subtext, marginTop: 4 },
  toggle: { marginTop: spacing.sm, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 20 },
  toggleText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
});
