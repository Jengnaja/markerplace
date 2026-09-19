import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // 🟢 State สำหรับควบคุม SweetAlert Custom Modal (เฉพาะ Error / Warning)
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  const showAlert = (
    type: 'success' | 'error' | 'warning',
    title: string,
    message: string,
    onConfirm?: () => void
  ) => {
    setAlertConfig({ visible: true, type, title, message, onConfirm });
  };

  const hideAlert = () => {
    const confirmAction = alertConfig.onConfirm;
    setAlertConfig((prev) => ({ ...prev, visible: false }));
    if (confirmAction) confirmAction();
  };

  // 🟢 ฟังก์ชันย้อนกลับแบบปลอดภัย
  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  // 🟢 Google Sign-In Setup (แก้ไขการส่ง Redirect URI เพื่อป้องกัน Error 400)
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '381830799523-91ggiglmapusbg6efr0s4m2cvja54s73.apps.googleusercontent.com',
    webClientId: '381830799523-91ggiglmapusbg6efr0s4m2cvja54s73.apps.googleusercontent.com',
    redirectUri: Platform.OS === 'web'
      ? 'http://localhost:8081'
      : makeRedirectUri({ scheme: 'marketplace' }),
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setLoading(true);

      signInWithCredential(auth, credential)
        .then(async (userCredential) => {
          const user = userCredential.user;
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          let isProfileCompleted = false;

          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.profileCompleted) {
              isProfileCompleted = true;
            }
          } else {
            // สร้าง Profile เริ่มต้นหากเป็นผู้ใช้ใหม่จาก Google
            await setDoc(userDocRef, {
              uid: user.uid,
              fullName: user.displayName || 'ผู้ใช้งาน Google',
              phone: user.phoneNumber || '',
              role: 'buyer',
              email: user.email,
              createdAt: new Date().toISOString(),
            });
          }

          // 🟢 นำทางทันทีโดยไม่ขึ้น Alert สำเร็จ
          if (isProfileCompleted) {
            router.replace('/(tabs)/home');
          } else {
            router.replace('/setup-profile');
          }
        })
        .catch((error) => {
          showAlert('error', 'เกิดข้อผิดพลาด', error.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้');
        })
        .finally(() => setLoading(false));
    }
  }, [response]);

  // --- เข้าสู่ระบบด้วย เบอร์โทร + รหัสผ่าน ---
  const formatPhoneToEmail = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    return `${cleanPhone}@marketplace.com`;
  };

  const handleLogin = async () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || !password) {
      showAlert('warning', 'แจ้งเตือน', 'กรุณากรอกเบอร์โทรศัพท์และรหัสผ่าน');
      return;
    }

    if (cleanPhone.length !== 10) {
      showAlert('warning', 'แจ้งเตือน', 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก');
      return;
    }

    setLoading(true);

    try {
      const formattedEmail = formatPhoneToEmail(cleanPhone);
      const userCredential = await signInWithEmailAndPassword(auth, formattedEmail, password);
      const user = userCredential.user;

      // 🟢 ดึงข้อมูลผู้ใช้งานจาก Firestore เพื่อตรวจสอบสถานะการตั้งค่าโปรไฟล์
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      let isProfileCompleted = false;

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.profileCompleted) {
          isProfileCompleted = true;
        }
      }

      // 🟢 นำทางทันทีโดยไม่ขึ้น Alert สำเร็จ
      if (isProfileCompleted) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/setup-profile');
      }
    } catch (error: any) {
      console.log('Login Error:', error.code, error.message);
      showAlert('error', 'เข้าสู่ระบบไม่สำเร็จ', 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* 🔴 SweetAlert Custom Modal Component */}
      <Modal transparent visible={alertConfig.visible} animationType="fade" onRequestClose={hideAlert}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View
              style={[
                styles.alertIconBg,
                alertConfig.type === 'success' && { backgroundColor: '#e8f5e9' },
                alertConfig.type === 'error' && { backgroundColor: '#ffebee' },
                alertConfig.type === 'warning' && { backgroundColor: '#fff3e0' },
              ]}
            >
              <Ionicons
                name={
                  alertConfig.type === 'success'
                    ? 'checkmark-circle-outline'
                    : alertConfig.type === 'error'
                    ? 'close-circle-outline'
                    : 'alert-circle-outline'
                }
                size={52}
                color={
                  alertConfig.type === 'success'
                    ? '#1a5d3a'
                    : alertConfig.type === 'error'
                    ? '#d32f2f'
                    : '#ed6c02'
                }
              />
            </View>
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.alertButton,
                alertConfig.type === 'success' && { backgroundColor: '#1a5d3a' },
                alertConfig.type === 'error' && { backgroundColor: '#d32f2f' },
                alertConfig.type === 'warning' && { backgroundColor: '#ed6c02' },
              ]}
              onPress={hideAlert}
            >
              <Text style={styles.alertButtonText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header & Back Button */}
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Ionicons name="arrow-back" size={24} color="#1a5d3a" />
            </TouchableOpacity>
          </View>

          {/* Title Header */}
          <View style={styles.titleContainer}>
            <Text style={styles.mainTitle}>ยินดีต้อนรับกลับมา 👋</Text>
            <Text style={styles.subTitle}>เข้าสู่ระบบเพื่อใช้งาน ตลาดชุมชนนนทบุรี</Text>
          </View>

          {/* ปุ่ม Google Sign-In */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.googleButton}
            onPress={() => promptAsync()}
            disabled={!request || loading}
          >
            <Ionicons name="logo-google" size={20} color="#ea4335" style={{ marginRight: 10 }} />
            <Text style={styles.googleButtonText}>เข้าสู่ระบบด้วย Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>หรือเข้าสู่ระบบด้วยเบอร์โทร</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form Inputs */}
          <View style={styles.formContainer}>
            {/* Phone Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>เบอร์โทรศัพท์</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="0812345678"
                  placeholderTextColor="#aaa"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>รหัสผ่าน</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="กรอกรหัสผ่านของคุณ"
                  placeholderTextColor="#aaa"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#888" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>เข้าสู่ระบบ</Text>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => router.push('/register')}
              disabled={loading}
            >
              <Text style={styles.registerLinkText}>
                ยังไม่มีบัญชีสมาชิก? <Text style={styles.registerLinkBold}>สมัครสมาชิก</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 40 },
  headerRow: { marginTop: 10, marginBottom: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f2f7f4', justifyContent: 'center', alignItems: 'center' },
  titleContainer: { marginBottom: 24 },
  mainTitle: { fontSize: 28, fontWeight: 'bold', color: '#1a5d3a', marginBottom: 6 },
  subTitle: { fontSize: 15, color: '#666666' },
  googleButton: { flexDirection: 'row', height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  googleButtonText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { marginHorizontal: 10, fontSize: 12, color: '#94a3b8' },
  formContainer: { gap: 16 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333333' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, height: 50, backgroundColor: '#f8fafc' },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 15, color: '#1e293b' },
  submitButton: { backgroundColor: '#1a5d3a', height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 4 },
  disabledButton: { backgroundColor: '#8cb89f' },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  registerLink: { alignItems: 'center', paddingVertical: 12 },
  registerLinkText: { fontSize: 14, color: '#64748b' },
  registerLinkBold: { color: '#1a5d3a', fontWeight: 'bold' },
  /* 🔴 SweetAlert Modal Styles */
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  alertBox: { width: '85%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 8 },
  alertIconBg: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 22, lineHeight: 20 },
  alertButton: { width: '100%', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  alertButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});