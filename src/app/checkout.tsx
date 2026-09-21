import React, { useState, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// 🟢 เพิ่ม updateDoc เข้ามาจาก firebase/firestore
import { doc, getDoc, collection, getDocs, query, where, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

export default function CheckoutScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);

  // 🏡 ข้อมูลที่อยู่จัดส่ง
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // 📝 Modal แก้ไขที่อยู่
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempAddress, setTempAddress] = useState('');
  const [tempPhone, setTempPhone] = useState('');

  // 🚚 ตัวเลือกขนส่ง & การชำระเงิน
  const [shippingMethod, setShippingMethod] = useState<'postal' | 'express'>('postal');
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cod'>('transfer');

  // 🎉 Modal สั่งซื้อสำเร็จ
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // 🟢 ดึงข้อมูลผู้ใช้ + ตะกร้าสินค้า
  useEffect(() => {
    const fetchCheckoutData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        router.replace('/(tabs)/home');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          const userFullName = uData.fullName || 'คุณสมใจ ใจดี';
          const userAddr = uData.address || '123 หมู่ 5 ต.บางศรีเมือง อ.เมือง จ.นนทบุรี 11000';
          const userPhone = uData.phone || '0812345678';

          setFullName(userFullName);
          setAddress(userAddr);
          setPhone(userPhone);

          setTempName(userFullName);
          setTempAddress(userAddr);
          setTempPhone(userPhone);
        }

        const cartQuery = query(collection(db, 'carts'), where('userId', '==', currentUser.uid));
        const cartSnap = await getDocs(cartQuery);
        const items: any[] = [];
        cartSnap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
        setCartItems(items);
      } catch (error) {
        console.log('Error fetching checkout data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCheckoutData();
  }, []);

  // 💰 คำนวณราคา
  const subtotalPrice = cartItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const shippingFee = shippingMethod === 'postal' ? 40 : 60;
  const totalPrice = subtotalPrice + shippingFee;

  // 💾 บันทึกการแก้ไขที่อยู่
  const handleSaveAddress = () => {
    setFullName(tempName);
    setAddress(tempAddress);
    setPhone(tempPhone);
    setIsEditAddressOpen(false);
    Keyboard.dismiss();
  };

  // 🚀 กดสั่งซื้อสินค้า
  const handleConfirmOrder = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || cartItems.length === 0) return;

    setSubmitting(true);
    try {
      // 🟢 1. ตัดสต็อกสินค้าในคอลเลกชัน 'products'
      for (const item of cartItems) {
        const prodId = item.productId || item.id;
        if (prodId) {
          const productRef = doc(db, 'products', prodId);
          const productSnap = await getDoc(productRef);

          if (productSnap.exists()) {
            const pData = productSnap.data();
            const currentStock = pData.stock !== undefined 
              ? Number(pData.stock) 
              : (pData.quantity !== undefined ? Number(pData.quantity) : 0);
            
            const purchasedQty = Number(item.quantity || 1);
            const newStock = Math.max(0, currentStock - purchasedQty);

            await updateDoc(productRef, {
              stock: newStock,
              quantity: newStock, // สำรองกรณีบางหน้าอ้างอิงฟิลด์ quantity
            });
          }
        }
      }

      // 🟢 2. สร้าง Order ใน Firestore
      const orderRef = await addDoc(collection(db, 'orders'), {
        userId: currentUser.uid,
        items: cartItems,
        shippingAddress: { fullName, address, phone },
        shippingMethod: shippingMethod === 'postal' ? 'ไปรษณีย์ไทย (3-5 วัน)' : 'ขนส่งเอกชน (1-2 วัน)',
        paymentMethod: paymentMethod === 'transfer' ? 'โอนเงินผ่านธนาคาร' : 'เก็บเงินปลายทาง',
        subtotalPrice,
        shippingFee,
        totalPrice,
        status: paymentMethod === 'transfer' ? 'pending_payment' : 'paid',
        createdAt: new Date().toISOString(),
      });

      // 🟢 3. เคลียร์รายการสินค้าออกจากตะกร้า
      for (const item of cartItems) {
        await deleteDoc(doc(db, 'carts', item.id));
      }

      // 🟢 4. แยกเคสตามวิธีการชำระเงิน
      if (paymentMethod === 'transfer') {
        // โอนเงินผ่านธนาคาร -> ส่งไปหน้าชำระเงิน (payment.tsx)
        router.push({
          pathname: '/payment',
          params: { orderId: orderRef.id, amount: totalPrice.toString() },
        });
      } else {
        // เก็บเงินปลายทาง -> แสดงป็อปอัปสั่งซื้อสำเร็จ
        setIsSuccessModalOpen(true);
      }
    } catch (error) {
      console.log('Error creating order:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a5d3a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9f5" />

      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ยืนยันการสั่งซื้อ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 📍 1. ที่อยู่จัดส่ง */}
        <Text style={styles.sectionTitle}>ที่อยู่จัดส่ง</Text>
        <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => setIsEditAddressOpen(true)}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.addressName}>{fullName || 'กรุณากรอกชื่อผู้รับ'}</Text>
            <Text style={styles.addressText}>{address || 'กรุณากรอกที่อยู่จัดส่ง'}</Text>
            {phone ? <Text style={styles.phoneText}>โทร: {phone}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>

        {/* 🚚 2. วิธีการจัดส่ง */}
        <Text style={styles.sectionTitle}>วิธีการจัดส่ง</Text>
        <View style={styles.cardContainer}>
          <TouchableOpacity style={styles.radioRow} activeOpacity={0.8} onPress={() => setShippingMethod('postal')}>
            <Ionicons name={shippingMethod === 'postal' ? 'radio-button-on' : 'radio-button-off'} size={22} color="#1a5d3a" />
            <Text style={styles.radioLabel}>ไปรษณีย์ไทย (3-5 วัน)</Text>
            <Text style={styles.priceText}>฿ 40</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.radioRow} activeOpacity={0.8} onPress={() => setShippingMethod('express')}>
            <Ionicons name={shippingMethod === 'express' ? 'radio-button-on' : 'radio-button-off'} size={22} color="#1a5d3a" />
            <Text style={styles.radioLabel}>ขนส่งเอกชน (1-2 วัน)</Text>
            <Text style={styles.priceText}>฿ 60</Text>
          </TouchableOpacity>
        </View>

        {/* 💳 3. วิธีการชำระเงิน */}
        <Text style={styles.sectionTitle}>วิธีการชำระเงิน</Text>
        <View style={styles.cardContainer}>
          <TouchableOpacity style={styles.radioRow} activeOpacity={0.8} onPress={() => setPaymentMethod('transfer')}>
            <Ionicons name={paymentMethod === 'transfer' ? 'radio-button-on' : 'radio-button-off'} size={22} color="#1a5d3a" />
            <Ionicons name="card" size={20} color="#2563eb" style={{ marginLeft: 8, marginRight: 4 }} />
            <Text style={styles.radioLabel}>โอนเงินผ่านธนาคาร</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.radioRow} activeOpacity={0.8} onPress={() => setPaymentMethod('cod')}>
            <Ionicons name={paymentMethod === 'cod' ? 'radio-button-on' : 'radio-button-off'} size={22} color="#1a5d3a" />
            <Ionicons name="cash" size={20} color="#dc2626" style={{ marginLeft: 8, marginRight: 4 }} />
            <Text style={styles.radioLabel}>เก็บเงินปลายทาง</Text>
          </TouchableOpacity>
        </View>

        {/* 🧾 4. สรุปยอดเงิน */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ค่าสินค้า</Text>
            <Text style={styles.summaryValue}>฿ {subtotalPrice.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ค่าจัดส่ง</Text>
            <Text style={styles.summaryValue}>฿ {shippingFee}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={styles.totalLabel}>รวมทั้งหมด</Text>
            <Text style={styles.totalPrice}>฿ {totalPrice.toLocaleString()}</Text>
          </View>
        </View>

        {/* 🟢 ปุ่มยืนยันการสั่งซื้อ */}
        <TouchableOpacity
          style={[styles.confirmBtn, submitting && { backgroundColor: '#8cb89f' }]}
          activeOpacity={0.85}
          onPress={handleConfirmOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.confirmBtnText}>ยืนยันการสั่งซื้อ</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* 📝 Modal แก้ไขที่อยู่จัดส่ง */}
      <Modal visible={isEditAddressOpen} transparent animationType="slide" onRequestClose={() => setIsEditAddressOpen(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardAvoidingContainer}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>แก้ไขที่อยู่จัดส่ง</Text>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
                  <Text style={styles.inputLabel}>ชื่อ-นามสกุล ผู้รับ</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tempName}
                    onChangeText={setTempName}
                    placeholder="ระบุชื่อผู้รับ"
                  />

                  <Text style={styles.inputLabel}>เบอร์โทรศัพท์</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tempPhone}
                    onChangeText={setTempPhone}
                    keyboardType="phone-pad"
                    placeholder="ระบุเบอร์โทรศัพท์"
                  />

                  <Text style={styles.inputLabel}>ที่อยู่จัดส่งโดยละเอียด</Text>
                  <TextInput
                    style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                    value={tempAddress}
                    onChangeText={setTempAddress}
                    multiline
                    placeholder="บ้านเลขที่, ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์"
                  />
                </ScrollView>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      setIsEditAddressOpen(false);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>ยกเลิก</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAddress}>
                    <Text style={styles.saveBtnText}>บันทึก</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 🎉 Modal สั่งซื้อสำเร็จ */}
      <Modal visible={isSuccessModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.successContent}>
            <Ionicons name="checkmark-circle" size={64} color="#1a5d3a" />
            <Text style={styles.successTitle}>สั่งซื้อสินค้าสำเร็จ!</Text>
            <Text style={styles.successSub}>ขอบคุณที่อุดหนุนสินค้าชุมชนของเรา</Text>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginTop: 10, marginBottom: 2 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  addressName: { fontSize: 15, fontWeight: 'bold', color: '#1e3a8a' },
  addressText: { fontSize: 14, color: '#475569', lineHeight: 20 },
  phoneText: { fontSize: 13, color: '#64748b' },
  cardContainer: { backgroundColor: '#ffffff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  radioLabel: { flex: 1, fontSize: 15, color: '#1e293b', marginLeft: 10 },
  priceText: { fontSize: 15, fontWeight: 'bold', color: '#1a5d3a' },
  divider: { height: 1, backgroundColor: '#f1f5f9' },
  summaryBox: { marginTop: 12, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 15, color: '#475569' },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  totalPrice: { fontSize: 22, fontWeight: 'bold', color: '#1a5d3a' },
  confirmBtn: { backgroundColor: '#1a5d3a', height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginTop: 20, elevation: 3 },
  confirmBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  /* Modal Edit Address (Bottom Sheet Style) */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingContainer: {
    width: '100%',
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 12 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginTop: 8, marginBottom: 4 },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: { flex: 1, height: 46, borderRadius: 23, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: 'bold', fontSize: 15 },
  saveBtn: { flex: 1, height: 46, borderRadius: 23, backgroundColor: '#1a5d3a', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },

  /* Modal Success */
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successContent: { width: '85%', backgroundColor: '#ffffff', borderRadius: 20, padding: 24, alignItems: 'center', gap: 12 },
  successTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  successSub: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  homeBtn: { backgroundColor: '#1a5d3a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 10 },
  homeBtnText: { color: '#ffffff', fontWeight: 'bold' },
});