import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // Modal แก้ไขโปรไฟล์
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);

  // 🟢 ดึงข้อมูลโปรไฟล์ผู้ใช้จาก Firestore
  useFocusEffect(
    useCallback(() => {
      const fetchUserData = async () => {
        setLoading(true);
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              setUserData(data);
              setEditName(data.fullName || currentUser.displayName || '');
              setEditPhone(data.phone || '');
              setEditAddress(data.address || '');

              const existingAvatar =
                data.profileImage ||
                data.avatarUrl ||
                data.photoURL ||
                currentUser.photoURL ||
                null;

              setEditAvatar(existingAvatar);
            } else {
              setEditName(currentUser.displayName || '');
              setEditAvatar(currentUser.photoURL || null);
            }
          } catch (error) {
            console.log('Error fetching user profile:', error);
          }
        }
        setLoading(false);
      };

      fetchUserData();
    }, [])
  );

  // 🖼️ เลือกรูปโปรไฟล์ใหม่จากคลังภาพ
  const handlePickAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('แจ้งเตือน', 'กรุณานุญาตให้เข้าถึงคลังรูปภาพเพื่อเปลี่ยนรูปโปรไฟล์');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      setEditAvatar(result.assets[0].uri);
    }
  };

  // 💾 บันทึกการแก้ไขโปรไฟล์ (ย่อพิกเซลเหลือ 300x300 แล้วแปลงเป็น Base64 ขนาดเล็ก)
  const handleSaveProfile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    if (!editName.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    setSaving(true);
    try {
      let finalAvatarUrl = editAvatar;

      // 🟢 ถ้ารูปเป็น file:// จากเครื่อง ให้ย่อขนาดเหลือ 300x300px และแปลงเป็น Base64 ทันที
      if (editAvatar && editAvatar.startsWith('file://')) {
        const manipResult = await ImageManipulator.manipulateAsync(
          editAvatar,
          [{ resize: { width: 300, height: 300 } }],
          { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        finalAvatarUrl = `data:image/jpeg;base64,${manipResult.base64}`;
      }

      // 1. อัปเดต Display Name ใน Auth
      await updateProfile(currentUser, {
        displayName: editName,
        photoURL: finalAvatarUrl?.startsWith('data:') ? currentUser.photoURL : finalAvatarUrl,
      });

      // 2. บันทึกข้อมูลลง Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), {
        fullName: editName,
        phone: editPhone,
        address: editAddress,
        profileImage: finalAvatarUrl,
        avatarUrl: finalAvatarUrl,
      });

      setUserData((prev: any) => ({
        ...prev,
        fullName: editName,
        phone: editPhone,
        address: editAddress,
        profileImage: finalAvatarUrl,
        avatarUrl: finalAvatarUrl,
      }));

      setEditAvatar(finalAvatarUrl);
      setIsEditModalOpen(false);
      Alert.alert('สำเร็จ', 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว');
    } catch (error) {
      console.log('Error saving profile:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  // 🚪 ออกจากระบบ
  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/login' as any);
          } catch (error) {
            console.log('Error signing out:', error);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a5d3a" />
      </View>
    );
  }

  const currentUser = auth.currentUser;
  const avatarUrl =
    userData?.profileImage ||
    userData?.avatarUrl ||
    userData?.photoURL ||
    currentUser?.photoURL;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9f5" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 👤 Header Profile + รูปโปรไฟล์ */}
        <View style={styles.profileHeader}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setIsEditModalOpen(true)} style={styles.avatarWrapper}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={44} color="#1a5d3a" />
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="#ffffff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>
            {userData?.fullName || currentUser?.displayName || 'ผู้ใช้งานทั่วไป'}
          </Text>
          <Text style={styles.userEmail}>{currentUser?.email || ''}</Text>

          {/* ✏️ ปุ่มแก้ไขโปรไฟล์ */}
          <TouchableOpacity
            style={styles.editProfileBtn}
            activeOpacity={0.8}
            onPress={() => setIsEditModalOpen(true)}
          >
            <Ionicons name="create-outline" size={16} color="#1a5d3a" />
            <Text style={styles.editProfileBtnText}>แก้ไขโปรไฟล์</Text>
          </TouchableOpacity>
        </View>

        {/* 📋 เมนูหลัก */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>การจัดการบัญชี</Text>

          {/* 📦 ปุ่มติดตามสถานะคำสั่งซื้อ */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/my-orders' as any)}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="receipt-outline" size={20} color="#0284c7" />
              </View>
              <Text style={styles.menuText}>สถานะคำสั่งซื้อของฉัน</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* 📍 ปุ่มแก้ไขข้อมูลที่อยู่ */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setIsEditModalOpen(true)}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="location-outline" size={20} color="#16a34a" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.menuText}>ข้อมูลที่อยู่จัดส่ง</Text>
                <Text style={styles.menuSubText} numberOfLines={1}>
                  {userData?.address || 'ยังไม่ได้ระบุที่อยู่'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </TouchableOpacity>

          {/* 🟢 🏪 แสดงปุ่มจัดการสินค้าเฉพาะผู้ใช้ที่เป็น 'seller' */}
          {userData?.role === 'seller' && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => router.push('/my-products' as any)}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.menuIconBg, { backgroundColor: '#fef3c7' }]}>
                    <Ionicons name="cube-outline" size={20} color="#d97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuText}>จัดการสินค้าของฉัน</Text>
                    <Text style={styles.menuSubText}>เพิ่ม / แก้ไข / ลบสินค้าในร้าน</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* 🚪 ปุ่มออกจากระบบ */}
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutBtnText}>ออกจากระบบ</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* 📝 Modal แก้ไขโปรไฟล์ */}
      <Modal visible={isEditModalOpen} transparent animationType="slide" onRequestClose={() => setIsEditModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>แก้ไขข้อมูลโปรไฟล์</Text>

            {/* เลือกรูปใน Modal */}
            <TouchableOpacity style={{ alignItems: 'center', marginVertical: 8 }} onPress={handlePickAvatar}>
              <View style={styles.modalAvatarWrapper}>
                {editAvatar ? (
                  <Image source={{ uri: editAvatar }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={40} color="#1a5d3a" />
                )}
              </View>
              <Text style={{ fontSize: 12, color: '#1a5d3a', fontWeight: 'bold', marginTop: 4 }}>เปลี่ยนรูปโปรไฟล์</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>ชื่อ-นามสกุล</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="ระบุชื่อ-นามสกุล"
            />

            <Text style={styles.inputLabel}>เบอร์โทรศัพท์</Text>
            <TextInput
              style={styles.textInput}
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              placeholder="ระบุเบอร์โทรศัพท์"
            />

            <Text style={styles.inputLabel}>ที่อยู่จัดส่งสินค้า</Text>
            <TextInput
              style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
              value={editAddress}
              onChangeText={setEditAddress}
              multiline
              placeholder="บ้านเลขที่, ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditModalOpen(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>บันทึก</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#faf9f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, gap: 16 },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
    elevation: 2,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#1a5d3a',
    position: 'relative',
    overflow: 'hidden',
  },
  modalAvatarWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a5d3a',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1a5d3a',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  userEmail: { fontSize: 13, color: '#64748b' },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginTop: 6,
  },
  editProfileBtnText: { fontSize: 13, fontWeight: 'bold', color: '#1a5d3a' },
  menuSection: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuIconBg: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuText: { fontSize: 15, color: '#1e293b', fontWeight: '600' },
  menuSubText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f1f5f9' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 10,
  },
  logoutBtnText: { fontSize: 15, fontWeight: 'bold', color: '#ef4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContent: { width: '100%', backgroundColor: '#ffffff', borderRadius: 20, padding: 20, gap: 8 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 2 },
  textInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#0f172a' },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
  saveBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#1a5d3a', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#ffffff', fontWeight: 'bold' },
});