import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // 🟢 ตรวจสอบสถานะการเข้าสู่ระบบแบบเรียลไทม์
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // ถ้าผู้ใช้เคยล็อกอินค้างไว้ เช็กว่าตั้งค่าโปรไฟล์หรือยัง
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists() && userDoc.data().profileCompleted) {
            // ตั้งค่าโปรไฟล์แล้ว -> ไปหน้าหลัก
            router.replace('/(tabs)/home');
          } else {
            // ยังไม่ตั้งค่าโปรไฟล์ -> ไปหน้า setup-profile
            router.replace('/setup-profile');
          }
        } catch (error) {
          console.log('Error checking user profile:', error);
        }
      }
      
      // ปิดหน้าจอโหลดเมื่อตรวจสอบเสร็จสิ้น
      if (initializing) {
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, []);

  // ⏳ แสดงหน้าจอโหลดระหว่างเช็กสถานะ (ป้องกันจอกระพริบ)
  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a5d3a" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="setup-profile" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});