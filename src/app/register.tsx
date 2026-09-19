import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  ImageBackground,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { useRouter } from 'expo-router';

export default function RegisterScreen() {
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');

  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [loading, setLoading] = useState(false);

  // 🚀 ฟังก์ชันสมัครสมาชิก (แปลงเบอร์เป็นอีเมล)
  const handleRegister = async () => {
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    if (!cleanPhone || !password.trim() || !fullName.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกเบอร์โทรศัพท์ รหัสผ่าน และชื่อ-นามสกุล');
      return;
    }

    if (cleanPhone.length < 9) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
      return;
    }

    if (role === 'seller' && !shopName.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณาระบุชื่อร้านค้าของคุณ');
      return;
    }

    setLoading(true);

    try {
      // 🟢 แปลงเบอร์โทรศัพท์เป็น Email สำหรับ Firebase Auth
      const generatedEmail = `${cleanPhone}@communityapp.com`;

      // 1. สร้างบัญชีผู้ใช้ใน Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, generatedEmail, password);
      const user = userCredential.user;

      // 2. อัปเดต Display Name
      await updateProfile(user, { displayName: fullName.trim() });

      // 3. บันทึกข้อมูลลง Firestore
      const userData: any = {
        uid: user.uid,
        email: generatedEmail,
        phone: cleanPhone,
        fullName: fullName.trim(),
        role: role,
        createdAt: new Date().toISOString(),
      };

      if (role === 'seller') {
        userData.shopName = shopName.trim();
      }

      await setDoc(doc(db, 'users', user.uid), userData);

      // 🟢 4. แยกการเปลี่ยนหน้า: ผู้ซื้อ -> setup-profile / ผู้ขาย -> home
      Alert.alert('สำเร็จ', 'สมัครสมาชิกเรียบร้อยแล้ว', [
        {
          text: 'ตกลง',
          onPress: () => {
            if (role === 'buyer') {
              router.replace('/setup-profile' as any);
            } else {
              router.replace('/(tabs)/home' as any);
            }
          },
        },
      ]);
    } catch (error: any) {
      console.log('Error registering:', error);
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('เกิดข้อผิดพลาด', 'เบอร์โทรศัพท์นี้ถูกใช้งานในระบบแล้ว');
      } else {
        Alert.alert('เกิดข้อผิดพลาด', error.message || 'ไม่สามารถสมัครสมาชิกได้');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/bgres.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.card}>
            <Text style={styles.title}>สร้างบัญชีใหม่ 📝</Text>
            <Text style={styles.subtitle}>กรอกเบอร์โทรศัพท์เพื่อสมัครสมาชิก</Text>

            {/* 🔘 ปุ่มเลือกบทบาท (ผู้ซื้อ / ผู้ขาย) */}
            <Text style={styles.label}>ประเภทบัญชีของคุณ</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'buyer' && styles.roleBtnActive]}
                onPress={() => setRole('buyer')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="cart-outline"
                  size={18}
                  color={role === 'buyer' ? '#ffffff' : '#64748b'}
                />
                <Text style={[styles.roleText, role === 'buyer' && styles.roleTextActive]}>
                  ผู้ซื้อสินค้า
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleBtn, role === 'seller' && styles.roleBtnActive]}
                onPress={() => setRole('seller')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="storefront-outline"
                  size={18}
                  color={role === 'seller' ? '#ffffff' : '#64748b'}
                />
                <Text style={[styles.roleText, role === 'seller' && styles.roleTextActive]}>
                  ผู้ขายสินค้า
                </Text>
              </TouchableOpacity>
            </View>

            {/* ฟอร์มกรอกข้อมูล */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>ชื่อ-นามสกุล *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ระบุชื่อ-นามสกุล"
                  placeholderTextColor="#a0aec0"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <Text style={styles.label}>เบอร์โทรศัพท์ (ใช้เป็นไอดีเข้าสู่ระบบ) *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="08X-XXX-XXXX"
                  placeholderTextColor="#a0aec0"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={styles.label}>รหัสผ่าน *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร"
                  placeholderTextColor="#a0aec0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {/* แสดงช่องกรอกชื่อร้านค้าเฉพาะเมื่อเลือกเป็น 'seller' */}
              {role === 'seller' && (
                <View style={{ gap: 4, marginTop: 4 }}>
                  <Text style={styles.label}>ชื่อร้านค้า *</Text>
                  <View style={[styles.inputWrapper, { borderColor: '#d97706', backgroundColor: '#fffbeb' }]}>
                    <Ionicons name="storefront" size={20} color="#d97706" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="ระบุชื่อร้านค้าของคุณ"
                      placeholderTextColor="#b45309"
                      value={shopName}
                      onChangeText={setShopName}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* ปุ่มสมัครสมาชิก */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && { backgroundColor: '#8cb89f' }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitText}>
                  {role === 'seller' ? 'สมัครเป็นผู้ขาย 🏪' : 'ถัดไป (ตั้งค่าโปรไฟล์) ➡️'}
                </Text>
              )}
            </TouchableOpacity>

            {/* ปุ่มกลับไปหน้าเข้าสู่ระบบ */}
            <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
              <Text style={styles.loginLinkText}>มีบัญชีอยู่แล้ว? <Text style={{ color: '#1a5d3a', fontWeight: 'bold' }}>เข้าสู่ระบบ</Text></Text>
            </TouchableOpacity>

          </View>

        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 40, justifyContent: 'center', minHeight: '100%' },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 24,
    padding: 22,
    gap: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a5d3a', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 6 },
  
  label: { fontSize: 13, fontWeight: 'bold', color: '#334155', marginTop: 4 },
  formGroup: { gap: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: '#ffffff',
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: '#0f172a' },

  roleContainer: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  roleBtnActive: { backgroundColor: '#1a5d3a', borderColor: '#1a5d3a' },
  roleText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  roleTextActive: { color: '#ffffff' },

  submitBtn: {
    backgroundColor: '#1a5d3a',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    elevation: 2,
  },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  loginLink: { marginTop: 8, alignItems: 'center' },
  loginLinkText: { fontSize: 13, color: '#64748b' },
});