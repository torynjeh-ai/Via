import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../theme';

export default function ReceiptScreen({ route, navigation }) {
  const { receipt } = route.params;
  const isContribution = receipt.receipt_type === 'contribution';
  const amount = isContribution ? receipt.payment?.amount : receipt.payout?.amount;
  const date = new Date(receipt.issued_at).toLocaleString();

  const handleShare = async () => {
    const lines = [
      `💜 Via Receipt`,
      `─────────────────────`,
      `Type: ${isContribution ? 'Contribution' : 'Payout'}`,
      `Receipt No: ${receipt.receipt_number}`,
      receipt.transaction_id ? `Transaction: ${receipt.transaction_id}` : '',
      `Amount: ${Number(amount).toLocaleString()} XAF`,
      `Status: ${receipt.status}`,
      `Date: ${date}`,
      `─────────────────────`,
      `Member: ${receipt.member.name}`,
      `Phone: ${receipt.member.phone}`,
      `Group: ${receipt.group.name}`,
      isContribution ? `Method: ${receipt.payment.method}` : `Position: #${receipt.payout.position}`,
      `─────────────────────`,
      `Thank you for using Via 🙏`,
    ].filter(Boolean).join('\n');

    await Share.share({ message: lines });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>💜 Via</Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {isContribution ? '💳 Contribution Receipt' : '💰 Payout Receipt'}
          </Text>
        </View>
      </View>

      {/* Status */}
      <View style={[styles.statusBanner, receipt.status === 'completed' ? styles.statusSuccess : styles.statusPending]}>
        <Ionicons
          name={receipt.status === 'completed' ? 'checkmark-circle' : 'time'}
          size={18}
          color={receipt.status === 'completed' ? '#16A34A' : '#CA8A04'}
        />
        <Text style={[styles.statusText, { color: receipt.status === 'completed' ? '#16A34A' : '#CA8A04' }]}>
          {receipt.status === 'completed' ? 'Payment Confirmed' : receipt.status}
        </Text>
      </View>

      {/* Amount */}
      <View style={styles.amountSection}>
        <Text style={styles.amountLabel}>{isContribution ? 'Amount Paid' : 'Amount Received'}</Text>
        <Text style={styles.amount}>{Number(amount).toLocaleString()} XAF</Text>
      </View>

      {/* Details */}
      <View style={styles.detailsCard}>
        <Row label="Receipt No." value={receipt.receipt_number} mono />
        {receipt.transaction_id && <Row label="Transaction ID" value={receipt.transaction_id} mono />}
        <Row label="Date" value={date} />
        <Row label="Member" value={receipt.member.name} />
        <Row label="Phone" value={receipt.member.phone} />
        <Row label="Group" value={receipt.group.name} />
        <Row label="Cycle" value={receipt.group.cycle} capitalize />
        {isContribution && (
          <>
            <Row label="Payment Method" value={receipt.payment.method} />
            <Row label="Cycle Number" value={`#${receipt.payment.cycle_number}`} />
          </>
        )}
        {!isContribution && (
          <>
            <Row label="Queue Position" value={`#${receipt.payout.position}`} />
            {receipt.payout.payout_date && (
              <Row label="Payout Date" value={new Date(receipt.payout.payout_date).toLocaleDateString()} />
            )}
            <Row label="Members in Group" value={String(receipt.group.member_count)} />
          </>
        )}
      </View>

      {/* Footer note */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Thank you for using Via 🙏</Text>
        <Text style={styles.footerSub}>Keep this receipt for your records.</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={colors.primary} />
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

function Row({ label, value, mono, capitalize }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono, capitalize && styles.capitalize]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40 },

  header: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logo: { fontSize: fontSize.lg, fontWeight: '700', color: colors.white },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '600', color: colors.white },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  statusSuccess: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF9C3' },
  statusText: { fontSize: fontSize.md, fontWeight: '600' },

  amountSection: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  amountLabel: { fontSize: fontSize.sm, color: colors.subtext, marginBottom: 4 },
  amount: { fontSize: 40, fontWeight: '800', color: colors.primary, letterSpacing: -1 },

  detailsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: fontSize.sm, color: colors.subtext, flex: 1 },
  rowValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: 11 },
  capitalize: { textTransform: 'capitalize' },

  footer: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  footerText: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
  footerSub: { fontSize: fontSize.sm, color: colors.subtext, marginTop: 2 },

  actions: { flexDirection: 'row', gap: 12 },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  shareBtnText: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },
  doneBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});
