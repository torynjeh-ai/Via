import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../theme';

export default function Input({ label, error, ...props }) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && { borderColor: colors.danger }]}
        placeholderTextColor={colors.subtext}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: fontSize.md, color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    padding: spacing.md, fontSize: fontSize.lg, color: colors.text, backgroundColor: colors.white,
  },
  error: { fontSize: fontSize.sm, color: colors.danger, marginTop: spacing.xs },
});
