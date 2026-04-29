import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../theme';

const TERMS = {
  member_joining: {
    title: 'Before You Join',
    subtitle: 'Membership Commitment',
    icon: '📋',
    intro: 'Please read and understand the following before joining this savings group.',
    points: [
      'Once you join and the circle begins, you are committed for the entire circle — you cannot leave mid-circle.',
      'You must make your contribution on time every cycle. Missing contributions affects all other members.',
      'You can only leave the group during the re-forming phase, after a full circle has been completed.',
      'If you leave during re-forming, you forfeit your membership permanently.',
      'By joining, you agree to the group\'s contribution amount and schedule.',
    ],
    warning: 'Only join if you are confident you can commit to the full circle.',
  },
  admin_approval: {
    title: 'Admin Responsibility',
    subtitle: 'Member Approval',
    icon: '⚖️',
    intro: 'By approving this member, you are personally vouching for their participation in this savings group.',
    points: [
      'You are responsible for ensuring this member understands the group\'s contribution rules.',
      'If this member fails to contribute on time, you may be held accountable by other members.',
      'If this member causes financial harm to the group, you bear partial moral and social responsibility.',
      'You confirm that you know this person and believe they are trustworthy.',
      'This approval is final and cannot be undone.',
    ],
    warning: 'Only approve members you personally trust and can vouch for.',
  },
  invite_vouching: {
    title: 'Inviter Responsibility',
    subtitle: 'Member Vouching',
    icon: '🤝',
    intro: 'By sharing your invite link, you are vouching for this person as a trustworthy member of this savings group.',
    points: [
      'You personally know this individual and believe they are reliable and financially responsible.',
      'Your reputation within the group is tied to the behaviour of people you invite.',
      'If the person you invited fails to contribute or causes harm, other members may hold you accountable.',
      'You are responsible for informing the person you invite about the group\'s rules.',
      'Do not share your invite link publicly or with people you do not know well.',
    ],
    warning: 'Only invite people you personally know and trust.',
  },
};

const FREQUENCY_OPTIONS = [
  { value: 'every_time', label: 'Every time', desc: 'Always show this reminder' },
  { value: 'per_group',  label: 'Once per group', desc: 'Remember per group' },
  { value: 'never',      label: "Don't show again", desc: 'I understand my responsibilities' },
];

export default function TermsModal({ type, memberName, visible, onAccept, onCancel }) {
  const terms = TERMS[type];
  const [frequency, setFrequency] = useState('every_time');
  const [checked, setChecked]     = useState(false);

  if (!terms) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.icon}>{terms.icon}</Text>
          <Text style={styles.title}>{terms.title}</Text>
          <Text style={styles.subtitle}>{terms.subtitle}</Text>
          {memberName && <Text style={styles.memberName}>For: {memberName}</Text>}
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.intro}>{terms.intro}</Text>
          {terms.points.map((p, i) => (
            <View key={i} style={styles.point}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
          <View style={styles.warning}>
            <Ionicons name="warning" size={16} color={colors.warning} />
            <Text style={styles.warningText}>{terms.warning}</Text>
          </View>
        </View>

        {/* Frequency — not shown for member joining */}
        {type !== 'member_joining' && (
          <View style={styles.frequencySection}>
            <Text style={styles.frequencyLabel}>How often would you like this reminder?</Text>
            {FREQUENCY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.freqOption, frequency === opt.value && styles.freqActive]}
                onPress={() => setFrequency(opt.value)}
              >
                <View style={[styles.radio, frequency === opt.value && styles.radioActive]}>
                  {frequency === opt.value && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.freqLabel}>{opt.label}</Text>
                  <Text style={styles.freqDesc}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Checkbox */}
        <TouchableOpacity style={styles.checkRow} onPress={() => setChecked(c => !c)}>
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked && <Ionicons name="checkmark" size={14} color={colors.white} />}
          </View>
          <Text style={styles.checkText}>I have read and understood my responsibilities. I accept these terms.</Text>
        </TouchableOpacity>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, !checked && styles.acceptBtnDisabled]}
            onPress={() => checked && onAccept(frequency)}
            disabled={!checked}
          >
            <Text style={styles.acceptBtnText}>
              {type === 'member_joining' ? 'I Agree — Join Group' : 'Accept & Proceed'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },

  header: { backgroundColor: colors.primary, padding: spacing.lg, alignItems: 'center' },
  icon: { fontSize: 40, marginBottom: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.white, marginBottom: 4 },
  subtitle: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  memberName: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)' },

  body: { padding: spacing.md },
  intro: { fontSize: fontSize.md, color: colors.text, marginBottom: spacing.md, lineHeight: 22 },
  point: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  bullet: { color: colors.primary, fontWeight: '700', fontSize: fontSize.md },
  pointText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  warning: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.primaryLight, padding: spacing.sm, borderRadius: 8, marginTop: spacing.sm },
  warningText: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },

  frequencySection: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  frequencyLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  freqOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.sm, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, marginBottom: spacing.sm },
  freqActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.subtext, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  freqLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  freqDesc: { fontSize: fontSize.sm, color: colors.subtext },

  checkRow: { flexDirection: 'row', gap: 12, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'flex-start' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },

  actions: { flexDirection: 'row', gap: 12, padding: spacing.md },
  cancelBtn: { flex: 1, padding: 13, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: fontSize.md, fontWeight: '600', color: colors.subtext },
  acceptBtn: { flex: 2, padding: 13, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center' },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});
