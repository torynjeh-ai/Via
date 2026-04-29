import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { verifyOtp } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, fontSize } from '../../theme';

export default function VerifyOtpScreen({ route, navigation }) {
  const { phone } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleVerify = async () => {
    if (code.length !== 6) return Alert.alert('Error', 'Enter the 6-digit OTP');
    setLoading(true);
    try {
      const res = await verifyOtp({ phone, code });
      await signIn(res.data.token, res.data.user);
    } catch (e) {
      Alert.alert('Error', e.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Phone</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {phone}</Text>
      <Input
        label="OTP Code" placeholder="123456" value={code}
        onChangeText={setCode} keyboardType="number-pad" maxLength={6}
      />
      <Button title="Verify" onPress={handleVerify} loading={loading} style={styles.btn} />
      <Button title="Back" onPress={() => navigation.goBack()} variant="outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: colors.subtext, marginBottom: spacing.xl },
  btn: { marginBottom: spacing.md },
});
