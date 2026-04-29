import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../components/Card';
import Button from '../components/Button';
import {
  getGroup, joinGroup, startGroup, approveMember, updateGroup,
  endCircle, startNextCircle, reconfirmMembership, forfeitMembership,
} from '../api/groups';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSize } from '../theme';
import { checkTerms, acceptTerms } from '../api/terms';
import TermsModal from '../components/TermsModal';

function EditGroupModal({ group, visible, onClose, onSaved }) {
  const isReforming = group?.status === 're-forming';
  const isForming   = group?.status === 'forming';
  const [name, setName]       = useState(group?.name || '');
  const [desc, setDesc]       = useState(group?.description || '');
  const [maxM, setMaxM]       = useState(String(group?.max_members || ''));
  const [amount, setAmount]   = useState(String(group?.contribution_amount || ''));
  const [cycle, setCycle]     = useState(group?.cycle || 'monthly');
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Group name is required');
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: desc.trim() };
      if ((isForming || isReforming) && maxM) {
        const max = Number(maxM);
        if (max < Number(group.member_count)) {
          Alert.alert('Error', `Cannot go below current count (${group.member_count})`);
          setSaving(false); return;
        }
        payload.max_members = max;
      }
      if (isReforming) {
        if (amount) payload.contribution_amount = Number(amount);
        payload.cycle = cycle;
      }
      await updateGroup(group.id, payload);
      onSaved(); onClose();
    } catch (e) { Alert.alert('Error', e.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.modalContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit Group Settings</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.modalField}>
          <Text style={styles.modalLabel}>Group Name</Text>
          <TextInput style={styles.modalInput} value={name} onChangeText={setName} />
        </View>
        <View style={styles.modalField}>
          <Text style={styles.modalLabel}>Description</Text>
          <TextInput style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc} multiline />
        </View>
        {(isForming || isReforming) && (
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Max Members</Text>
            <TextInput style={styles.modalInput} value={maxM} onChangeText={setMaxM} keyboardType="number-pad" />
            <Text style={styles.modalHint}>Current: {group?.member_count}</Text>
          </View>
        )}
        {isReforming && (
          <>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Contribution Amount (XAF)</Text>
              <TextInput style={styles.modalInput} value={amount} onChangeText={setAmount} keyboardType="number-pad" />
              <Text style={styles.modalHint}>Applies to all members for the next circle</Text>
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Cycle</Text>
              <View style={styles.cycleRow}>
                {['weekly', 'biweekly', 'monthly'].map(c => (
                  <TouchableOpacity key={c} style={[styles.cycleBtn, cycle === c && styles.cycleBtnActive]} onPress={() => setCycle(c)}>
                    <Text style={[styles.cycleBtnText, cycle === c && styles.cycleBtnTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
        {!isReforming && (
          <View style={styles.modalNote}>
            <Ionicons name="lock-closed" size={14} color={colors.subtext} />
            <Text style={styles.modalNoteText}>Contribution amount and cycle can only be changed during re-forming.</Text>
          </View>
        )}
        <View style={styles.modalActions}>
          <Button title="Cancel" onPress={onClose} variant="outline" style={styles.modalBtn} />
          <Button title={saving ? 'Saving...' : 'Save Changes'} onPress={handleSave} loading={saving} style={styles.modalBtn} />
        </View>
      </ScrollView>
    </Modal>
  );
}
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Group name is required');
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: desc.trim() };
      if ((isForming || isReforming) && maxM) {
        const max = Number(maxM);
        if (max < Number(group.member_count)) { Alert.alert('Error', `Cannot go below current count (${group.member_count})`); setSaving(false); return; }
        payload.max_members = max;
      }
      if (isReforming) {
        if (amount) payload.contribution_amount = Number(amount);
        payload.cycle = cycle;
      }
      await updateGroup(group.id, payload);
      onSaved(); onClose();
    } catch (e) { Alert.alert('Error', e.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.modalContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit Group Settings</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
        </View>
        <View style={styles.modalField}>
          <Text style={styles.modalLabel}>Group Name</Text>
          <TextInput style={styles.modalInput} value={name} onChangeText={setName} />
        </View>
        <View style={styles.modalField}>
          <Text style={styles.modalLabel}>Description</Text>
          <TextInput style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc} multiline />
        </View>
        {(isForming || isReforming) && (
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Max Members</Text>
            <TextInput style={styles.modalInput} value={maxM} onChangeText={setMaxM} keyboardType="number-pad" />
            <Text style={styles.modalHint}>Current: {group?.member_count}</Text>
          </View>
        )}
        {isReforming && (
          <>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Contribution Amount (XAF)</Text>
              <TextInput style={styles.modalInput} value={amount} onChangeText={setAmount} keyboardType="number-pad" />
              <Text style={styles.modalHint}>Applies to all members for the next circle</Text>
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Cycle</Text>
              <View style={styles.cycleRow}>
                {['weekly', 'biweekly', 'monthly'].map(c => (
                  <TouchableOpacity key={c} style={[styles.cycleBtn, cycle === c && styles.cycleBtnActive]} onPress={() => setCycle(c)}>
                    <Text style={[styles.cycleBtnText, cycle === c && styles.cycleBtnTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
        {!isReforming && (
          <View style={styles.modalNote}>
            <Ionicons name="lock-closed" size={14} color={colors.subtext} />
            <Text style={styles.modalNoteText}>Contribution amount and cycle can only be changed during re-forming.</Text>
          </View>
        )}
        <View style={styles.modalActions}>
          <Button title="Cancel" onPress={onClose} variant="outline" style={styles.modalBtn} />
          <Button title={saving ? 'Saving...' : 'Save Changes'} onPress={handleSave} loading={saving} style={styles.modalBtn} />
        </View>
      </ScrollView>
    </Modal>
  );
}

export default function GroupDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [termsModal, setTermsModal] = useState(null);

  const load = async () => { try { const res = await getGroup(id); setGroup(res.data); } catch {} };
  useEffect(() => { load(); }, []);

  const myMember = group?.members?.find(m => m.user_id === user?.id);
  const isAdmin = myMember?.role === 'admin';
  const isMember = !!myMember;
  const myStatus = myMember?.status;
  const isReforming = group?.status === 're-forming';

  const handleJoin = async () => {
    setTermsModal({
      type: 'member_joining',
      memberName: null,
      onConfirm: async () => {
        setTermsModal(null);
        setLoading(true);
        try { await joinGroup(id, {}); Alert.alert('Success', 'Join request sent'); await load(); }
        catch (e) { Alert.alert('Error', e.message); } finally { setLoading(false); }
      },
    });
  };

  const handleStart = async () => {
    setLoading(true);
    try { await startGroup(id); Alert.alert('Success', 'Group started!'); await load(); }
    catch (e) { Alert.alert('Error', e.message); } finally { setLoading(false); }
  };

  const handleApprove = async (userId, memberName) => {
    const check = await checkTerms('admin_approval', id).catch(() => ({ data: { must_show: true } }));
    if (check.data.must_show) {
      setTermsModal({
        type: 'admin_approval',
        memberName,
        onConfirm: async (frequency) => {
          await acceptTerms('admin_approval', frequency, id);
          setTermsModal(null);
          try { await approveMember(id, userId); await load(); }
          catch (e) { Alert.alert('Error', e.message); }
        },
      });
    } else {
      try { await approveMember(id, userId); await load(); }
      catch (e) { Alert.alert('Error', e.message); }
    }
  };

  const handleEndCircle = () => {
    Alert.alert('End Circle', 'Complete the current circle and return to re-forming?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Circle', style: 'destructive', onPress: () =>
        Alert.alert('Keep Rules?', 'Keep existing rules for the next circle?', [
          { text: 'Edit Rules', onPress: () => doEndCircle(false) },
          { text: 'Keep Rules', onPress: () => doEndCircle(true) },
        ])
      },
    ]);
  };

  const doEndCircle = async (keepRules) => {
    setActionLoading('end');
    try {
      await endCircle(id, { keep_rules: keepRules });
      Alert.alert('Circle Ended', 'Group is now re-forming.');
      await load();
      if (!keepRules) setEditOpen(true);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setActionLoading(''); }
  };

  const handleReconfirm = () => {
    Alert.alert('Re-confirm', 'Continue to the next circle?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Re-confirm', onPress: async () => {
        setActionLoading('reconfirm');
        try { await reconfirmMembership(id); Alert.alert('Confirmed!', 'You are in for the next circle.'); await load(); }
        catch (e) { Alert.alert('Error', e.message); } finally { setActionLoading(''); }
      }},
    ]);
  };

  const handleForfeit = () => {
    Alert.alert('Forfeit', 'You will be permanently removed from this group. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forfeit', style: 'destructive', onPress: async () => {
        setActionLoading('forfeit');
        try { await forfeitMembership(id); Alert.alert('Forfeited', 'You have left the group.'); await load(); }
        catch (e) { Alert.alert('Error', e.message); } finally { setActionLoading(''); }
      }},
    ]);
  };

  const handleStartNextCircle = async (force = false) => {
    setActionLoading('start-next');
    try {
      await startNextCircle(id, { force });
      Alert.alert('Started!', `Circle ${group.circle_number} has begun.`);
      await load();
    } catch (e) {
      if (e.message?.includes('have not yet re-confirmed')) {
        Alert.alert('Pending Members', e.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Force Start', style: 'destructive', onPress: () => handleStartNextCircle(true) },
        ]);
      } else { Alert.alert('Error', e.message); }
    } finally { setActionLoading(''); }
  };

  if (!group) return <View style={styles.center}><Text>Loading...</Text></View>;

  const pendingCount = group.members?.filter(m => m.status === 'pending_reconfirm').length || 0;
  const confirmedCount = group.members?.filter(m => m.status === 'approved').length || 0;

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description && <Text style={styles.desc}>{group.description}</Text>}
          </View>
          {isAdmin && (
            <TouchableOpacity onPress={() => setEditOpen(true)} style={styles.editBtn}>
              <Ionicons name="settings-outline" size={22} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.info}>{Number(group.contribution_amount).toLocaleString()} XAF · {group.cycle}</Text>
        <Text style={styles.info}>{group.status} · {group.member_count}/{group.max_members} members{group.circle_number > 1 ? ` · Circle ${group.circle_number}` : ''}</Text>
      </Card>

      {isReforming && isMember && (
        <Card style={styles.reformingCard}>
          <Text style={styles.reformingTitle}>Circle {(group.circle_number || 1) - 1} Complete!</Text>
          <Text style={styles.reformingText}>Re-forming for Circle {group.circle_number}.</Text>
          <Text style={styles.reformingStats}>{confirmedCount} confirmed · {pendingCount} pending</Text>
          {myStatus === 'pending_reconfirm' && (
            <View style={styles.reformingActions}>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleReconfirm}>
                <Text style={styles.confirmBtnText}>Re-confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.forfeitBtn} onPress={handleForfeit}>
                <Text style={styles.forfeitBtnText}>Forfeit</Text>
              </TouchableOpacity>
            </View>
          )}
          {myStatus === 'approved' && <Text style={styles.confirmedText}>You re-confirmed</Text>}
        </Card>
      )}

      <View style={styles.actions}>
        {!isMember && group.status === 'forming' && <Button title="Join Group" onPress={handleJoin} loading={loading} style={styles.btn} />}
        {isMember && group.status === 'active' && <Button title="Contribute" onPress={() => navigation.navigate('Contribute', { groupId: id, amount: group.contribution_amount })} style={styles.btn} />}
        {isMember && <Button title="View Payouts" onPress={() => navigation.navigate('Payouts', { groupId: id })} variant="outline" style={styles.btn} />}
        {isAdmin && group.status === 'forming' && <Button title="Start Group" onPress={handleStart} loading={loading} variant="outline" style={styles.btn} />}
        {isAdmin && group.status === 'active' && <Button title="End Circle" onPress={handleEndCircle} variant="outline" style={styles.btn} disabled={actionLoading === 'end'} />}
        {isAdmin && isReforming && <Button title={`Start Circle ${group.circle_number}`} onPress={() => handleStartNextCircle(false)} style={styles.btn} disabled={actionLoading === 'start-next'} />}
      </View>

      <Text style={styles.sectionTitle}>Members ({group.members?.length})</Text>
      {group.members?.map(m => (
        <Card key={m.id}>
          <View style={styles.row}>
            <View>
              <Text style={styles.memberName}>{m.name} {m.user_id === user?.id ? '(You)' : ''}</Text>
              <Text style={styles.memberInfo}>{m.phone}</Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.memberStatus, { color: m.status === 'approved' ? colors.success : m.status === 'pending_reconfirm' ? colors.warning : m.status === 'forfeited' ? colors.danger : colors.subtext }]}>
                {m.status === 'pending_reconfirm' ? 'awaiting' : m.status}
              </Text>
              {isAdmin && m.status === 'pending' && (
                <TouchableOpacity onPress={() => handleApprove(m.user_id, m.name)}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Card>
      ))}

      {group && <EditGroupModal group={group} visible={editOpen} onClose={() => setEditOpen(false)} onSaved={() => { load(); }} />}

      {termsModal && (
        <TermsModal
          type={termsModal.type}
          memberName={termsModal.memberName}
          visible={!!termsModal}
          onAccept={termsModal.onConfirm}
          onCancel={() => setTermsModal(null)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: { backgroundColor: colors.primary },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  editBtn: { padding: spacing.xs },
  groupName: { fontSize: fontSize.xl, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  desc: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.8)', marginBottom: spacing.xs },
  info: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)' },
  reformingCard: { backgroundColor: colors.primary, marginBottom: spacing.sm },
  reformingTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.white, marginBottom: 4 },
  reformingText: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  reformingStats: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)', marginBottom: spacing.sm },
  reformingActions: { flexDirection: 'row', gap: 10 },
  confirmBtn: { flex: 1, backgroundColor: colors.success, padding: 10, borderRadius: 10, alignItems: 'center' },
  confirmBtnText: { color: colors.white, fontWeight: '600', fontSize: fontSize.md },
  forfeitBtn: { flex: 1, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', padding: 10, borderRadius: 10, alignItems: 'center' },
  forfeitBtnText: { color: colors.white, fontWeight: '600', fontSize: fontSize.md },
  confirmedText: { color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: fontSize.md },
  actions: { marginVertical: spacing.md },
  btn: { marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  right: { alignItems: 'flex-end', gap: 4 },
  memberName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  memberInfo: { fontSize: fontSize.sm, color: colors.subtext },
  memberStatus: { fontSize: fontSize.sm, fontWeight: '600' },
  modalContainer: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  modalField: { marginBottom: spacing.md },
  modalLabel: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text, marginBottom: 6 },
  modalInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, padding: spacing.sm, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.white },
  modalHint: { fontSize: fontSize.sm, color: colors.subtext, marginTop: 4 },
  modalNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryLight, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.lg },
  modalNoteText: { fontSize: fontSize.sm, color: colors.subtext, flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1 },
  cycleRow: { flexDirection: 'row', gap: 8 },
  cycleBtn: { flex: 1, padding: 10, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, alignItems: 'center' },
  cycleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  cycleBtnText: { fontSize: fontSize.sm, color: colors.text, textTransform: 'capitalize' },
  cycleBtnTextActive: { color: colors.white, fontWeight: '600' },
});
