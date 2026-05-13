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

// Doc number format rules
const DOC_PATTERNS = {
  passport: { regex: /^[A-Z0-9]{6,20}$/, hint: '6–20 alphanumeric characters (e.g. A12345678)' },
  id:       { regex: /^[A-Z0-9\-]{5,20}$/, hint: '5–20 alphanumeric characters or hyphens' },
};

const validateDocNumber = (value, type) => {
  if (!type || !value.trim()) return '';
  const { regex, hint } = DOC_PATTERNS[type];
  return regex.test(value.trim().toUpperCase()) ? '' : hint;
};

export default function SetupProfileScreen() {
  const { setUser } = useAuth();

  // step: 1=doc type+number, 2=doc images (front+back), 3=face, 4=review, 5=submitting
  const [step, setStep]               = useState(1);
  const [docType, setDocType]         = useState('passport'); // 'passport' | 'id'
  const [docNumber, setDocNumber]     = useState('');
  const [docNumberError, setDocNumberError] = useState('');
  const [docFront, setDocFront]       = useState(null);
  const [docBack, setDocBack]         = useState(null);
  const [faceImage, setFaceImage]     = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const docLabel = docType === 'passport' ? 'Passport' : 'National ID';

  const handleDocNumberChange = (val) => {
    const upper = val.toUpperCase().replace(/\s+/g, '');
    setDocNumber(upper);
    setDocNumberError(validateDocNumber(upper, docType));
  };

  const pickImage = async (setter) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setter(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission needed', 'Camera access is required for face verification');
        return;
      }
    }
    setCameraActive(true);
  };

  const captureFace = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
    setFaceImage(`data:image/jpeg;base64,${photo.base64}`);
    setCameraActive(false);
  };

  const goToDocImages = () => {
    const err = validateDocNumber(docNumber, docType);
    if (err) { setDocNumberError(err); return; }
    setDocNumberError('');
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const res = await setupProfile({
        doc_type:        docType,
        doc_number:      docNumber.trim().toUpperCase(),
        doc_image_front: docFront,
        doc_image_back:  docBack,
        face_image:      faceImage,
      });
      setUser(res.data);
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
      setStep(3); // back to face step
    } finally {
      setLoading(false);
    }
  };

  const STEP_LABELS = ['Document', 'Photos', 'Face', 'Review'];

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
        {STEP_LABELS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.dot, step > i + 1 && styles.dotDone, step === i + 1 && styles.dotActive]}>
              <Text style={[styles.dotText, step >= i + 1 && styles.dotTextActive]}>
                {step > i + 1 ? '✓' : i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, step === i + 1 && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

      {/* ── STEP 1: Doc type + number ── */}
      {step === 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Document Details</Text>
          <Text style={styles.hint}>Choose your document type and enter the number exactly as it appears.</Text>

          {/* Doc type toggle */}
          <View style={styles.docToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, docType === 'passport' && styles.toggleBtnActive]}
              onPress={() => { setDocType('passport'); setDocNumber(''); setDocNumberError(''); }}
            >
              <Text style={[styles.toggleText, docType === 'passport' && styles.toggleTextActive]}>🛂 Passport</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, docType === 'id' && styles.toggleBtnActive]}
              onPress={() => { setDocType('id'); setDocNumber(''); setDocNumberError(''); }}
            >
              <Text style={[styles.toggleText, docType === 'id' && styles.toggleTextActive]}>🪪 National ID</Text>
            </TouchableOpacity>
          </View>

          <Input
            label={`${docLabel} Number`}
            value={docNumber}
            onChangeText={handleDocNumberChange}
            placeholder={docType === 'passport' ? 'e.g. A12345678' : 'e.g. 123456789'}
            autoCapitalize="characters"
            maxLength={20}
          />
          {docNumberError ? (
            <Text style={styles.fieldError}>⚠ {docNumberError}</Text>
          ) : docNumber ? (
            <Text style={styles.fieldOk}>✓ Format looks good</Text>
          ) : null}

          <Button
            title="Continue to Photos →"
            onPress={goToDocImages}
            style={styles.btn}
            disabled={!docNumber.trim() || !!docNumberError}
          />
        </View>
      )}

      {/* ── STEP 2: Front + back document photos ── */}
      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{docLabel} Photos</Text>
          <Text style={styles.hint}>Upload clear photos of both sides. All text must be fully readable.</Text>

          {/* Front */}
          <Text style={styles.fieldLabel}>Front Side</Text>
          <Text style={styles.fieldHint}>
            {docType === 'passport'
              ? 'The photo page with your face and personal details'
              : 'The front showing your photo and name'}
          </Text>
          {docFront ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: docFront }} style={styles.docImg} />
              <TouchableOpacity onPress={() => setDocFront(null)} style={styles.retakeBtn}>
                <Text style={styles.retakeText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setDocFront)}>
              <Text style={styles.uploadIcon}>📄</Text>
              <Text style={styles.uploadText}>Tap to upload front side</Text>
              <Text style={styles.uploadHint}>JPG or PNG</Text>
            </TouchableOpacity>
          )}

          {/* Back */}
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Back Side</Text>
          <Text style={styles.fieldHint}>
            {docType === 'passport'
              ? 'The page with the machine-readable zone (MRZ lines)'
              : 'The back showing the barcode or additional details'}
          </Text>
          {docBack ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: docBack }} style={styles.docImg} />
              <TouchableOpacity onPress={() => setDocBack(null)} style={styles.retakeBtn}>
                <Text style={styles.retakeText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setDocBack)}>
              <Text style={styles.uploadIcon}>🔄</Text>
              <Text style={styles.uploadText}>Tap to upload back side</Text>
              <Text style={styles.uploadHint}>JPG or PNG</Text>
            </TouchableOpacity>
          )}

          <View style={styles.btnRow}>
            <Button title="← Back" onPress={() => setStep(1)} variant="outline" style={styles.halfBtn} />
            <Button
              title="Continue →"
              onPress={() => setStep(3)}
              style={styles.halfBtn}
              disabled={!docFront || !docBack}
            />
          </View>
        </View>
      )}

      {/* ── STEP 3: Face capture ── */}
      {step === 3 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Face Verification</Text>
          <Text style={styles.hint}>Take a selfie. We'll compare it against your {docLabel.toLowerCase()} photo.</Text>

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
            <Button title="← Back" onPress={() => { setCameraActive(false); setStep(2); }} variant="outline" style={styles.halfBtn} />
            <Button title="Continue →" onPress={() => setStep(4)} style={styles.halfBtn} disabled={!faceImage} />
          </View>
        </View>
      )}

      {/* ── STEP 4: Review & submit ── */}
      {step === 4 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review & Submit</Text>
          <Text style={styles.hint}>Confirm your details before submitting.</Text>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Document Type</Text>
            <Text style={styles.reviewValue}>{docLabel}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{docLabel} Number</Text>
            <Text style={styles.reviewValue}>{docNumber}</Text>
          </View>

          <View style={styles.reviewImages}>
            <View style={styles.reviewImgBox}>
              <Image source={{ uri: docFront }} style={styles.reviewImg} />
              <Text style={styles.reviewImgLabel}>Front</Text>
            </View>
            <View style={styles.reviewImgBox}>
              <Image source={{ uri: docBack }} style={styles.reviewImg} />
              <Text style={styles.reviewImgLabel}>Back</Text>
            </View>
            <View style={styles.reviewImgBox}>
              <Image source={{ uri: faceImage }} style={styles.reviewFaceImg} />
              <Text style={styles.reviewImgLabel}>Selfie</Text>
            </View>
          </View>

          <View style={styles.btnRow}>
            <Button title="← Back" onPress={() => setStep(3)} variant="outline" style={styles.halfBtn} />
            <Button
              title={loading ? 'Submitting...' : 'Submit ✓'}
              onPress={handleSubmit}
              style={styles.halfBtn}
              disabled={loading}
            />
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

  steps: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 16, marginBottom: spacing.lg },
  stepItem: { alignItems: 'center', gap: 4 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: colors.primary },
  dotDone: { backgroundColor: colors.success },
  dotText: { fontSize: 13, fontWeight: '700', color: colors.subtext },
  dotTextActive: { color: colors.white },
  stepLabel: { fontSize: 11, color: colors.subtext, textAlign: 'center' },
  stepLabelActive: { color: colors.primary, fontWeight: '600' },

  errorBox: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 10, marginBottom: spacing.md },
  errorText: { color: '#DC2626', fontSize: fontSize.md },

  card: { backgroundColor: colors.white, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: 4 },
  hint: { fontSize: fontSize.sm, color: colors.subtext, marginBottom: spacing.md },

  docToggle: { flexDirection: 'row', gap: 12, marginBottom: spacing.md },
  toggleBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.background },
  toggleBtnActive: { borderColor: colors.primary, backgroundColor: '#F0EEFF' },
  toggleText: { fontSize: fontSize.md, color: colors.subtext, fontWeight: '500' },
  toggleTextActive: { color: colors.primary, fontWeight: '700' },

  fieldLabel: { fontSize: fontSize.md, fontWeight: '500', color: colors.text, marginBottom: 4 },
  fieldHint: { fontSize: fontSize.sm, color: colors.subtext, marginBottom: spacing.sm },
  fieldError: { fontSize: fontSize.sm, color: '#DC2626', marginTop: 4, marginBottom: spacing.sm },
  fieldOk: { fontSize: fontSize.sm, color: colors.success, marginTop: 4, marginBottom: spacing.sm },

  uploadBox: { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  uploadIcon: { fontSize: 36, marginBottom: spacing.sm },
  uploadText: { fontSize: fontSize.md, color: colors.text, marginBottom: 4 },
  uploadHint: { fontSize: fontSize.sm, color: colors.subtext },

  previewBox: { alignItems: 'center', marginBottom: spacing.md },
  docImg: { width: '100%', height: 180, borderRadius: 10, resizeMode: 'cover', borderWidth: 2, borderColor: colors.border },
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

  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.sm },
  reviewLabel: { fontSize: fontSize.md, color: colors.subtext },
  reviewValue: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, letterSpacing: 1 },
  reviewImages: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: spacing.md },
  reviewImgBox: { alignItems: 'center' },
  reviewImg: { width: 100, height: 75, borderRadius: 8, resizeMode: 'cover', borderWidth: 2, borderColor: colors.border },
  reviewFaceImg: { width: 75, height: 75, borderRadius: 37, resizeMode: 'cover', borderWidth: 2, borderColor: colors.primary },
  reviewImgLabel: { fontSize: fontSize.sm, color: colors.subtext, marginTop: 4 },
});
