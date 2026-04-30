import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import Input from '../../components/Input';
import Button from '../../components/Button';
import PhoneInput from '../../components/PhoneInput';
import LanguagePicker from '../../components/LanguagePicker';
import { register } from '../../api/auth';
import { useLanguage } from '../../context/LanguageContext';
import { colors, spacing, fontSize } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleRegister = async () => {
    if (!name || !phone) return Alert.alert('Error', t('fullName') + ' and ' + t('phoneNumber') + ' are required');
    setLoading(true);
    try {
      await register({ name, phone, password });
      navigation.navigate('VerifyOtp', { phone });
    } catch (e) {
      Alert.alert('Error', e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Text style={styles.logo}>💜 Via</Text>
        <LanguagePicker compact />
      </View>
      <Text style={styles.title}>{t('createAccount')}</Text>
      <Text style={styles.subtitle}>{t('registerSubtitle')}</Text>

      <Input label={t('fullName')} value={name} onChangeText={setName} />
      <PhoneInput label={t('phoneNumber')} onChangePhone={setPhone} />
      <Input
        label={t('passwordOptional')}
        placeholder={t('passwordHint')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button title={t('register')} onPress={handleRegister} loading={loading} style={styles.btn} />
      <Button
        title={t('alreadyHaveAccount') + ' ' + t('signIn')}
        onPress={() => navigation.navigate('Login')}
        variant="outline"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  logo: { fontSize: fontSize.xl, fontWeight: '700', color: colors.primary },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: colors.subtext, marginBottom: spacing.xl },
  btn: { marginBottom: spacing.md },
});
