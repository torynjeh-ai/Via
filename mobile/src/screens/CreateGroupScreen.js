import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import Input from '../components/Input';
import Button from '../components/Button';
import { createGroup } from '../api/groups';
import { colors, spacing, fontSize } from '../theme';

const CYCLES = ['weekly', 'biweekly', 'monthly'];

export default function CreateGroupScreen({ navigation }) {
  const [form, setForm] = useState({ name: '', description: '', contribution_amount: '', cycle: 'monthly', max_members: '10' });
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.name || !form.contribution_amount) return Alert.alert('Error', 'Name and amount are required');
    setLoading(true);
    try {
      await createGroup({ ...form, contribution_amount: parseFloat(form.contribution_amount), max_members: parseInt(form.max_members) });
      Alert.alert('Success', 'Group created!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Njangi Group</Text>
      <Input label="Group Name" placeholder="My Njangi" value={form.name} onChangeText={set('name')} />
      <Input label="Description (optional)" placeholder="About this group" value={form.description} onChangeText={set('description')} multiline />
      <Input label="Contribution Amount (XAF)" placeholder="5000" value={form.contribution_amount} onChangeText={set('contribution_amount')} keyboardType="numeric" />
      <Input label="Max Members" placeholder="10" value={form.max_members} onChangeText={set('max_members')} keyboardType="numeric" />

      <Text style={styles.label}>Cycle</Text>
      <View style={styles.cycles}>
        {CYCLES.map((c) => (
          <Button
            key={c} title={c}
            onPress={() => set('cycle')(c)}
            variant={form.cycle === c ? 'primary' : 'outline'}
            style={styles.cycleBtn}
          />
        ))}
      </View>

      <Button title="Create Group" onPress={handleCreate} loading={loading} style={{ marginTop: spacing.md }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.background },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  label: { fontSize: fontSize.md, color: colors.text, fontWeight: '500', marginBottom: spacing.sm },
  cycles: { flexDirection: 'row', gap: spacing.sm },
  cycleBtn: { flex: 1 },
});
