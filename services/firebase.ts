import { initializeApp, getApps, getApp } from 'firebase/app';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBrRAM50cZxBF-Ipe8r_Lp17-P_pOCow6s",
  authDomain: "marketplace-49c4e.firebaseapp.com",
  projectId: "marketplace-49c4e",
  storageBucket: "marketplace-49c4e.firebasestorage.app",
  messagingSenderId: "381830799523",
  appId: "1:381830799523:web:32d324e8c1a29e9e839f16",
  measurementId: "G-NTE1W3765C"
};

// 1. จัดการการ initialize Firebase App ป้องกันซ้ำ
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. จัดการ Auth พร้อมป้องกันปัญหา auth/already-initialized ตอน Hot-reload
let authInstance: any;

if (Platform.OS === 'web') {
  authInstance = getAuth(app);
} else {
  try {
    // พยายาม initializeAuth พร้อมกำหนด Persistence สำหรับ React Native
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error: any) {
    // หากเคยถูก initialize ไปแล้ว ให้ดึง instance เดิมออกมาใช้งานแทน
    if (error.code === 'auth/already-initialized') {
      authInstance = getAuth(app);
    } else {
      console.error("Firebase Auth Initialization error:", error);
      authInstance = getAuth(app);
    }
  }
}

export const auth = authInstance;

// Export ฐานข้อมูล Firestore และ Storage
export const db = getFirestore(app);
export const storage = getStorage(app);