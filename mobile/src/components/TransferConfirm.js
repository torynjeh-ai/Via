import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { colors, spacing, fontSize } from '../theme';

export default function TransferConfirm({ visible, preview, loading, error, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Confirm Transfer</Text>

          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Calculating details...</Text>
            </View>
          )}

          {error && !loading && (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {preview && !loading && !error && (
            <ScrollView>
              <View style={styles.recipient}>
                <Text style={styles.recipientLabel}>To</Text>
                <Text style={styles.recipientName}>{preview.recipient_name || 'Recipient'}</Text>
              </View>

              <View style={styles.breakdown}>
                <Row label="You send" value={`${Number(preview.tc_amount).toFixed(4)} TC`} />
                <Row
                  label="Fee"
                  value={Number(preview.fee_tc) > 0 ? `${Number(preview.fee_tc).toFixed(4)} TC` : 'Free'}
                  valueStyle={Number(preview.fee_tc) === 0 ? styles.free : null}
                />
                <View style={styles.divider} />
                <Row label="Total deducted" value={`${Number(preview.total_tc).toFixed(4)} TC`} bold />
                <Row
                  label="Recipient gets"
                  value={`${Number(preview.tc_amount).toFixed(4)} TC`}
                  valueStyle={styles.credit}
                />
                <Row
                  label="≈ XAF"
                  value={`${(Number(preview.tc_amount) * 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })} XAF`}
                />
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, bold, valueStyle }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, maxHeight: '80%' },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  center: { alignItems: 'center', paddingVertical: spacing.xl },
  loadingText: { marginTop: spacing.sm, color: colors.subtext },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: spacing.md },
  recipient: { backgroundColor: colors.primaryLight, borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  recipientLabel: { fontSize: fontSize.sm, color: colors.subtext },
  recipientName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  breakdown: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: fontSize.md, color: colors.subtext },
  rowValue: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  bold: { fontSize: fontSize.lg },
  free: { color: colors.success },
  credit: { color: colors.success },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  actions: { flexDirection: 'row', gap: 12, marginTop: spacing.md },
  cancelBtn: { flex: 1, padding: 13, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: fontSize.md, fontWeight: '600', color: colors.subtext },
  confirmBtn: { flex: 2, padding: 13, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center' },
  confirmBtnText: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});
