import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import { updateMe, updateProfilePicture } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSize } from '../theme';

export default function ProfileScreen() {
  const { user, setUser, signOut } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const [pictureLoading, setPictureLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const res = await updateMe({ name });
      setUser(res.data);
      Alert.alert('Success', 'Profile updated');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePicture = async () => {
    Alert.alert(
      'Profile Picture',
      'Choose an option',
      [
        { text: 'Camera', onPress: () => openCamera() },
        { text: 'Gallery', onPress: () => openGallery() },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const openCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera access is required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
      aspect: [1, 1],
      allowsEditing: true,
    });

    if (!result.canceled) {
      uploadProfilePicture(result.assets[0].base64);
    }
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
      aspect: [1, 1],
      allowsEditing: true,
    });

    if (!result.canceled) {
      uploadProfilePicture(result.assets[0].base64);
    }
  };

  const uploadProfilePicture = async (base64Image) => {
    setPictureLoading(true);
    try {
      const res = await updateProfilePicture({ 
        profile_picture: base64Image 
      });
      setUser(res.data);
      Alert.alert('Success', 'Profile picture updated');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update profile picture');
    } finally {
      setPictureLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.avatarCard}>
        <TouchableOpacity 
          style={styles.avatarContainer} 
          onPress={handleProfilePicture}
          disabled={pictureLoading}
        >
          {user?.profile_picture_url ? (
            <Image 
              source={{ uri: user.profile_picture_url }} 
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={styles.trustRow}>
          <Text style={styles.trust}>{user?.tc_balance != null ? `${Number(user.tc_balance).toFixed(2)} TC` : '0.00 TC'}</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Edit Profile</Text>
        <Input label="Full Name" value={name} onChangeText={setName} />
        <Button title="Save Changes" onPress={handleUpdate} loading={loading} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.info}>Role: {user?.role}</Text>
        <Text style={styles.info}>Verified: {user?.is_verified ? 'Yes ✓' : 'No'}</Text>
      </Card>

      <Button title="Sign Out" onPress={signOut} variant="outline" style={styles.signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  avatarCard: { alignItems: 'center', backgroundColor: colors.primary },
  avatarContainer: { position: 'relative', marginBottom: spacing.sm },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(255,255,255,0.3)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: { fontSize: 36, fontWeight: '700', color: colors.white },
  userName: { fontSize: fontSize.xl, fontWeight: '700', color: colors.white },
  phone: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.8)', marginBottom: spacing.xs },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trust: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.9)' },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  info: { fontSize: fontSize.md, color: colors.subtext, marginBottom: spacing.xs },
  signOut: { marginTop: spacing.sm, borderColor: colors.danger },
});