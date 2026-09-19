import React, { useState } from 'react';
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
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

// 📌 กำหนดเบอร์โทรศัพท์ หรือ เลขบัตรประชาชน ที่ผูกพร้อมเพย์ของร้านค้า
const PROMPTPAY_NUMBER = '0613826127'; 

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const orderId = params.orderId as string;
  const amount = params.amount ? Number(params.amount) : 0;

  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // 🟢 URL เจนรูป QR Code พร้อมเพย์ตามยอดเงินอัตโนมัติ
  const qrCodeUrl = `https://promptpay.io/${PROMPTPAY_NUMBER}/${amount}.png`;

  // 📷 1. เลือกรูปสลิปจากคลังภาพ
  const handlePickSlip = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('แจ้งเตือน', 'กรุณานุญาตให้เข้าถึงคลังรูปภาพเพื่อแนบสลิป');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setSlipImage(result.assets[0].uri);
    }
  };

  // 🚀 2. กดส่งหลักฐานการโอนเงิน (รอผู้ขายตรวจสอบ)
  const handleSubmitSlip = async () => {
    if (!slipImage) {
      Alert.alert('แจ้งเตือน', 'กรุณาแนบรูปสลิปการโอนเงินก่อนกดยืนยัน');
      return;
    }

    setSubmitting(true);
    const currentUser = auth.currentUser;

    try {
      // 1. อัปเดตสถานะ Order เป็น waiting_approval พร้อมบันทึกรูปสลิป
      if (orderId) {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'waiting_approval',
          slipImage: slipImage,
          submittedAt: new Date().toISOString(),
        });
      }

      // 2. เคลียร์สินค้าในตะกร้าของผู้ใช้
      if (currentUser) {
        const cartQuery = query(collection(db, 'carts'), where('userId', '==', currentUser.uid));
        const cartSnap = await getDocs(cartQuery);
        for (const cartDoc of cartSnap.docs) {
          await deleteDoc(doc(db, 'carts', cartDoc.id));
        }
      }

      setIsSuccessModalOpen(true);
    } catch (error) {
      console.log('Error submitting slip:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถส่งหลักฐานการโอนเงินได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9f5" />

      {/* 🟢 Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ชำระเงินผ่าน QR Code</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* 💵 การ์ดแสดง PromptPay QR Code */}
        <View style={styles.qrCard}>
          <Text style={styles.promptpayTitle}>พร้อมเพย์ (PromptPay)</Text>
          <Text style={styles.merchantName}>ตลาดชุมชนออนไลน์</Text>

          <View style={styles.qrWrapper}>
            <Image source={{ uri: qrCodeUrl }} style={styles.qrImage} resizeMode="contain" />
          </View>

          <View style={styles.amountBadge}>
            <Text style={styles.amountLabel}>ยอดชำระเงินสุทธิ</Text>
            <Text style={styles.amountText}>฿ {amount.toLocaleString()}</Text>
          </View>
        </View>

        {/* 📷 ส่วนแนบรูปสลิปโอนเงิน */}
        <Text style={styles.sectionTitle}>แนบหลักฐานการโอนเงิน</Text>
        <TouchableOpacity style={styles.uploadCard} activeOpacity={0.8} onPress={handlePickSlip}>
          {slipImage ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: slipImage }} style={styles.previewImage} resizeMode="cover" />
              <Text style={styles.changeImageText}>กดเพื่อเปลี่ยนรูปสลิป</Text>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="cloud-upload-outline" size={36} color="#1a5d3a" />
              <Text style={styles.uploadTitle}>กดเพื่อเลือกรูปสลิปโอนเงิน</Text>
              <Text style={styles.uploadSub}>รองรับไฟล์รูปภาพ PNG, JPG</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 🟢 ปุ่มส่งหลักฐานการโอนเงิน */}
        <TouchableOpacity
          style={[styles.payBtn, (!slipImage || submitting) && { backgroundColor: '#8cb89f' }]}
          activeOpacity={0.85}
          onPress={handleSubmitSlip}
          disabled={!slipImage || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.payBtnText}>ส่งหลักฐานการโอนเงิน ✨</Text>
          )}
        </TouchableOpacity>

      </ScrollView>

      {/* 🎉 Modal ส่งหลักฐานสำเร็จ */}
      <Modal visible={isSuccessModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successContent}>
            <Ionicons name="time-outline" size={64} color="#1a5d3a" />
            <Text style={styles.successTitle}>ส่งหลักฐานเรียบร้อยแล้ว!</Text>
            <Text style={styles.successSub}>
              ผู้ขายจะทำการตรวจสอบหลักฐานการโอนเงิน และจัดส่งสินค้าให้โดยเร็วที่สุด
            </Text>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => {
                setIsSuccessModalOpen(false);
                router.replace('/(tabs)/home');
              }}
            >
              <Text style={styles.homeBtnText}>กลับสู่หน้าหลัก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#faf9f5' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30, gap: 16 },

  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
    elevation: 2,
  },
  promptpayTitle: { fontSize: 18, fontWeight: 'bold', color: '#003b6a' },
  merchantName: { fontSize: 13, color: '#64748b', marginTop: 2 },
  qrWrapper: {
    width: 200,
    height: 200,
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  qrImage: { width: '100%', height: '100%' },
  amountBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    width: '100%',
  },
  amountLabel: { fontSize: 12, color: '#166534' },
  amountText: { fontSize: 24, fontWeight: 'bold', color: '#1a5d3a' },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginTop: 4 },
  uploadCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1a5d3a',
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  uploadPlaceholder: { alignItems: 'center', gap: 6 },
  uploadTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a5d3a' },
  uploadSub: { fontSize: 12, color: '#64748b' },
  imagePreviewWrapper: { alignItems: 'center', gap: 8 },
  previewImage: { width: 140, height: 180, borderRadius: 12 },
  changeImageText: { fontSize: 13, color: '#1a5d3a', fontWeight: 'bold' },

  payBtn: {
    backgroundColor: '#1a5d3a',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    elevation: 3,
  },
  payBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  successContent: { width: '85%', backgroundColor: '#ffffff', borderRadius: 20, padding: 24, alignItems: 'center', gap: 12 },
  successTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  successSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  homeBtn: { backgroundColor: '#1a5d3a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 10 },
  homeBtnText: { color: '#ffffff', fontWeight: 'bold' },
});