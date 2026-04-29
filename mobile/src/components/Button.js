import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../theme';

export default function Button({ title, onPress, loading, variant = 'primary', style }) {
  const bg = variant === 'outline' ? 'transparent' : colors[variant] || colors.primary;
  const textColor = variant === 'outline' ? colors.primary : colors.white;
  const borderColor = variant === 'outline' ? colors.primary : 'transparent';

  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: bg, borderColor, borderWidth: 1.5 }, style]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={textColor} />
        : <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: spacing.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: fontSize.lg, fontWeight: '600' },
});
