import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, fontSize } from '../theme';

export default function WalletCode({ walletCode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!walletCode) return;
    await Clipboard.setStringAsync(walletCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Wallet Code</Text>
      <View style={styles.row}>
        <Text style={styles.code}>{walletCode || '—'}</Text>
        <TouchableOpacity style={[styles.copyBtn, copied && styles.copiedBtn]} onPress={handleCopy} disabled={!walletCode}>
          <Text style={styles.copyText}>{copied ? '✓ Copied' : '📋 Copy'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Share this code so others can send you TC</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.subtext, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, letterSpacing: 2 },
  copyBtn: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: 8 },
  copiedBtn: { backgroundColor: colors.success + '20' },
  copyText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  hint: { fontSize: fontSize.sm, color: colors.subtext, marginTop: 6 },
});
