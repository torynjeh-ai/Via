import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Input from '../../components/Input';
import Button from '../../components/Button';
import PhoneInput from '../../components/PhoneInput';
import LanguagePicker from '../../components/LanguagePicker';
import { login } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { colors, spacing, fontSize } from '../../theme';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { t } = useLanguage();

  const handleLogin = async () => {
    if (!phone) return Alert.alert('Error', t('phoneNumber') + ' is required');
    setLoading(true);
    try {
      const res = await login({ phone, password });
      if (res.data?.token) {
        await signIn(res.data.token, res.data.user);
      } else {
        navigation.navigate('VerifyOtp', { phone });
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.logo}>💜 Via</Text>
        <LanguagePicker compact />
      </View>
      <Text style={styles.title}>{t('welcomeBack')}</Text>
      <Text style={styles.subtitle}>{t('signInSubtitle')}</Text>

      <PhoneInput label={t('phoneNumber')} onChangePhone={setPhone} />
      <Input
        label={t('password')}
        placeholder="••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button title={t('signIn')} onPress={handleLogin} loading={loading} style={styles.btn} />
      <Button
        title={t('noAccount') + ' ' + t('register')}
        onPress={() => navigation.navigate('Register')}
        variant="outline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  logo: { fontSize: fontSize.xl, fontWeight: '700', color: colors.primary },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: colors.subtext, marginBottom: spacing.xl },
  btn: { marginBottom: spacing.md },
});
