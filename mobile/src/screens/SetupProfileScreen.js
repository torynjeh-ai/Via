import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Input from '../components/Input';
import Button from '../components/Button';
import { setupProfile } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSize } from '../theme';

export default function SetupProfileScreen() {
  const { setUser } = useAuth();
  const [step, setStep] = useState(1);
  const [passportNumber, setPassportNumber] = useState('');
  const [passportImage, setPassportImage] = useState(null);
  const [faceImage, setFaceImage] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const pickPassport = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setPassportImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { Alert.alert('Permission needed', 'Camera access is required for face verification'); return; }
    }
    setCameraActive(true);
  };

  const captureFace = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
    setFaceImage(`data:image/jpeg;base64,${photo.base64}`);
    setCameraActive(false);
  };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const res = await setupProfile({
        passport_number: passportNumber,
        passport_image: passportImage,
        face_image: faceImage,
      });
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Passport', 'Face Scan', 'Review'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.icon}>🛡️</Text>
        <Text style={styles.title}>Identity Verification</Text>
        <Text style={styles.subtitle}>Required before creating groups, joining, or making contributions</Text>
      </View>

      {/* Step indicators */}
      <View style={styles.steps}>
        {steps.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.dot, step > i + 1 && styles.dotDone, step === i + 1 && styles.dotActive]}>
              <Text style={[styles.dotText, (step >= i + 1) && styles.dotTextActive]}>
                {step > i + 1 ? '✓' : i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, step === i + 1 && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

      {/* Step 1: Passport */}
      {step === 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passport Details</Text>
          <Text style={styles.hint}>Enter your passport number and upload a clear photo.</Text>

          <Input
            label="Passport Number"
            value={passportNumber}
            onChangeText={t => setPassportNumber(t.toUpperCase())}
            placeholder="e.g. A12345678"
            autoCapitalize="characters"
            maxLength={20}
          />

          <Text style={styles.fieldLabel}>Passport Photo</Text>
          {passportImage ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: passportImage }} style={styles.passportImg} />
              <TouchableOpacity onPress={() => setPassportImage(null)} style={styles.retakeBtn}>
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBox} onPress={pickPassport}>
              <Text style={styles.uploadIcon}>📄</Text>
              <Text style={styles.uploadText}>Tap to upload passport image</Text>
              <Text style={styles.uploadHint}>JPG or PNG</Text>
            </TouchableOpacity>
          )}

          <Button
            title="Continue →"
            onPress={() => setStep(2)}
            style={styles.btn}
            disabled={!passportNumber.trim() || !passportImage}
          />
        </View>
      )}

      {/* Step 2: Face */}
      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Face Verification</Text>
          <Text style={styles.hint}>Take a selfie to verify your identity.</Text>

          {cameraActive ? (
            <View style={styles.cameraContainer}>
              <CameraView ref={cameraRef} style={styles.camera} facing="front">
                <View style={styles.faceGuide} />
              </CameraView>
              <Button title="📸 Capture" onPress={captureFace} style={styles.captureBtn} />
            </View>
          ) : faceImage ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: faceImage }} style={styles.faceImg} />
              <TouchableOpacity onPress={() => { setFaceImage(null); openCamera(); }} style={styles.retakeBtn}>
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBox} onPress={openCamera}>
              <Text style={styles.uploadIcon}>📷</Text>
              <Text style={styles.uploadText}>Tap to open camera</Text>
              <Text style={styles.uploadHint}>Make sure your face is well-lit</Text>
            </TouchableOpacity>
          )}

          <View style={styles.btnRow}>
            <Button title="← Back" onPress={() => { setCameraActive(false); setStep(1); }} variant="outline" style={styles.halfBtn} />
            <Button title="Continue →" onPress={() => setStep(3)} style={styles.halfBtn} disabled={!faceImage} />
          </View>
        </View>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review & Submit</Text>
          <Text style={styles.hint}>Confirm your details before submitting.</Text>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Passport Number</Text>
            <Text style={styles.reviewValue}>{passportNumber}</Text>
          </View>

          <View style={styles.reviewImages}>
            <View style={styles.reviewImgBox}>
              <Image source={{ uri: passportImage }} style={styles.reviewImg} />
              <Text style={styles.reviewImgLabel}>Passport</Text>
            </View>
            <View style={styles.reviewImgBox}>
              <Image source={{ uri: faceImage }} style={styles.reviewFaceImg} />
              <Text style={styles.reviewImgLabel}>Face</Text>
            </View>
          </View>

          <View style={styles.btnRow}>
            <Button title="← Back" onPress={() => setStep(2)} variant="outline" style={styles.halfBtn} />
            <Button title={loading ? 'Submitting...' : 'Submit ✓'} onPress={handleSubmit} style={styles.halfBtn} loading={loading} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  icon: { fontSize: 48, marginBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: fontSize.md, color: colors.subtext, textAlign: 'center' },
  steps: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: spacing.lg },
  stepItem: { alignItems: 'center', gap: 4 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: colors.primary },
  dotDone: { backgroundColor: colors.success },
  dotText: { fontSize: 13, fontWeight: '700', color: colors.subtext },
  dotTextActive: { color: colors.white },
  stepLabel: { fontSize: fontSize.sm, color: colors.subtext },
  stepLabelActive: { color: colors.primary, fontWeight: '600' },
  errorBox: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 10, marginBottom: spacing.md },
  errorText: { color: '#DC2626', fontSize: fontSize.md },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: 4 },
  hint: { fontSize: fontSize.sm, color: colors.subtext, marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.md, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
  uploadBox: { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  uploadIcon: { fontSize: 36, marginBottom: spacing.sm },
  uploadText: { fontSize: fontSize.md, color: colors.text, marginBottom: 4 },
  uploadHint: { fontSize: fontSize.sm, color: colors.subtext },
  previewBox: { alignItems: 'center', marginBottom: spacing.md },
  passportImg: { width: '100%', height: 180, borderRadius: 10, resizeMode: 'cover' },
  faceImg: { width: 160, height: 160, borderRadius: 80, borderWidth: 4, borderColor: colors.primary },
  retakeBtn: { marginTop: spacing.sm, borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: 20, paddingVertical: 6, borderRadius: 8 },
  retakeText: { color: colors.primary, fontSize: fontSize.md },
  cameraContainer: { marginBottom: spacing.md },
  camera: { height: 280, borderRadius: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  faceGuide: { width: 160, height: 200, borderRadius: 80, borderWidth: 3, borderColor: 'rgba(108,99,255,0.8)' },
  captureBtn: { marginTop: spacing.sm },
  btn: { marginTop: spacing.sm },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: spacing.sm },
  halfBtn: { flex: 1 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.md },
  reviewLabel: { fontSize: fontSize.md, color: colors.subtext },
  reviewValue: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, letterSpacing: 1 },
  reviewImages: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: spacing.md },
  reviewImgBox: { alignItems: 'center' },
  reviewImg: { width: 120, height: 90, borderRadius: 10, resizeMode: 'cover', borderWidth: 2, borderColor: colors.border },
  reviewFaceImg: { width: 90, height: 90, borderRadius: 45, resizeMode: 'cover', borderWidth: 2, borderColor: colors.primary },
  reviewImgLabel: { fontSize: fontSize.sm, color: colors.subtext, marginTop: 4 },
});
