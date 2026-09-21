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
  Image,
  Modal,
  TextInput,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
// ✨ เพิ่ม where เข้ามาจาก firebase/firestore
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';

// 🟢 เปิดใช้งาน LayoutAnimation สำหรับ Android และ iOS
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// 🟢 ตัวแปลงสถานะคำสั่งซื้อเป็นภาษาไทย + สี Badge
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'รอชำระเงิน', color: '#d97706', bg: '#fef3c7' },
  waiting_approval: { label: 'รอตรวจสอบสลิป', color: '#0284c7', bg: '#e0f2fe' },
  paid: { label: 'กำลังเตรียมจัดส่ง', color: '#15803d', bg: '#dcfce7' },
  shipped: { label: 'อยู่ระหว่างจัดส่ง', color: '#7e22ce', bg: '#f3e8ff' },
  completed: { label: 'สำเร็จแล้ว', color: '#16a34a', bg: '#dcfce7' },
};

export default function CartScreen() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>('buyer');
  const [loading, setLoading] = useState(true);
  
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

  // 🟢 ดึงข้อมูล (แยกระหว่าง ผู้ซื้อ ดึง carts / ผู้ขาย ดึง orders ของร้านตัวเอง)
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        setLoading(true);
        const currentUser = auth.currentUser;
        let currentRole = 'buyer';

        if (currentUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists() && userDoc.data().role) {
              currentRole = userDoc.data().role;
              setUserRole(currentRole);
            }
          } catch (error) {
            console.log('Error fetching user role:', error);
          }

          if (currentRole === 'seller') {
  // 📦 ฝั่งผู้ขาย: ดึงคำสั่งซื้อทั้งหมดแล้วกรองเฉพาะรายการที่เป็นของร้านเรา
  try {
    const querySnapshot = await getDocs(collection(db, 'orders'));
    const orderList: any[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // ตรวจสอบว่า sellerId ตรงกับเรา (เช็กทั้งระดับบน และเช็กในรายชื่อสินค้า items)
      const isMyOrder =
        data.sellerId === currentUser.uid ||
        data.shopId === currentUser.uid ||
        (Array.isArray(data.items) && data.items.some((item: any) => item.sellerId === currentUser.uid));

      if (isMyOrder) {
        // กรองเอาเฉพาะสินค้าที่เป็นของร้านเรามาแสดงผล
        const myItems = Array.isArray(data.items)
          ? data.items.filter((item: any) => !item.sellerId || item.sellerId === currentUser.uid)
          : [];

        orderList.push({
          id: docSnap.id,
          ...data,
          items: myItems.length > 0 ? myItems : data.items,
        });
      }
    });

    // เรียงลำดับจากคำสั่งซื้อล่าสุดขึ้นก่อน
    orderList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    setSellerOrders(orderList);
  } catch (error) {
    console.log('Error fetching seller orders:', error);
  }
} else {
            // 🛒 ฝั่งผู้ซื้อ: ดึงสินค้าในตะกร้า
            try {
              const cartQuery = query(collection(db, 'carts'));
              const querySnapshot = await getDocs(cartQuery);
              const itemList: any[] = [];
              querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.userId === currentUser.uid) {
                  itemList.push({ id: docSnap.id, ...data });
                }
              });
              setCartItems(itemList);
            } catch (error) {
              console.log('Error fetching cart:', error);
            }
          }
        }
        setLoading(false);
      };

      fetchData();
    }, [])
  );

  // ➕/➖ ปรับจำนวนสินค้าในตะกร้า
  const updateQuantity = async (cartId: string, currentQty: number, delta: number) => {
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      deleteCartItem(cartId);
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      await updateDoc(doc(db, 'carts', cartId), { quantity: newQty });
      setCartItems((prev) => prev.map((item) => (item.id === cartId ? { ...item, quantity: newQty } : item)));
    } catch (error) { console.log('Error updating quantity:', error); }
  };

  // 🗑️ ลบสินค้าออกจากตะกร้า
  const deleteCartItem = async (cartId: string) => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    try {
      await deleteDoc(doc(db, 'carts', cartId));
      setCartItems((prev) => prev.filter((item) => item.id !== cartId));
    } catch (error) { console.log('Error deleting item:', error); }
  };

  // ✅ ฝั่งผู้ขาย: อนุมัติสลิปโอนเงิน (เปลี่ยนเป็น paid)
  const handleApproveSlip = async (orderId: string) => {
    Alert.alert('ยืนยันการชำระเงิน', 'ตรวจสอบยอดเงินถูกต้องและต้องการอนุมัติออเดอร์นี้ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'อนุมัติยอดเงิน',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'orders', orderId), { status: 'paid' });
            setSellerOrders((prev) =>
              prev.map((ord) => (ord.id === orderId ? { ...ord, status: 'paid' } : ord))
            );
            setSelectedOrder(null);
            Alert.alert('สำเร็จ', 'อนุมัติคำสั่งซื้อเรียบร้อยแล้ว');
          } catch (error) {
            console.log('Error approving slip:', error);
          }
        },
      },
    ]);
  };

  // 📦 ฝั่งผู้ขาย: ยืนยันการจัดส่งสินค้า (เปลี่ยนเป็น shipped พร้อมใส่เลขพัสดุ)
  const handleShipOrder = async (orderId: string) => {
    if (!trackingNumber.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกเลขพัสดุหรือชื่อขนส่งก่อนกดยืนยัน');
      return;
    }
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'shipped',
        trackingNumber: trackingNumber.trim(),
      });
      setSellerOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: 'shipped', trackingNumber: trackingNumber.trim() } : ord))
      );
      setTrackingNumber('');
      setSelectedOrder(null);
      Alert.alert('สำเร็จ', 'อัปเดตสถานะเป็นกำลังจัดส่งแล้ว');
    } catch (error) {
      console.log('Error shipping order:', error);
    }
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a5d3a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)/home')} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1a5d3a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {userRole === 'seller' ? 'คำสั่งซื้อจากลูกค้า 📦' : 'ตะกร้าสินค้าของฉัน 🛒'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ================= 🛒 โหมดผู้ซื้อ (Buyer) ================= */}
      {userRole === 'buyer' ? (
        cartItems.length > 0 ? (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.cartList}>
                {cartItems.map((item) => (
                  <View key={item.id} style={styles.cartCard}>
                    <Image source={{ uri: item.image }} style={styles.cartImage} resizeMode="cover" />
                    <View style={styles.cartInfo}>
                      <Text style={styles.cartTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.cartPrice}>฿ {item.price}</Text>

                      <View style={styles.qtyRow}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, item.quantity, -1)}>
                          <Ionicons name="remove" size={16} color="#334155" />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, item.quantity, 1)}>
                          <Ionicons name="add" size={16} color="#1a5d3a" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteCartItem(item.id)}>
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.checkoutFooter}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>ราคารวมทั้งหมด</Text>
                <Text style={styles.totalPrice}>฿ {totalPrice.toLocaleString()}</Text>
              </View>
              <TouchableOpacity
                style={styles.checkoutBtn}
                activeOpacity={0.85}
                onPress={() => router.push('/checkout')}
              >
                <Text style={styles.checkoutBtnText}>ดำเนินการสั่งซื้อ ✨</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.emptyContainer}>
              <Ionicons name="cart-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>ตะกร้าสินค้าว่างเปล่า</Text>
              <Text style={styles.emptySubtitle}>เลือกซื้อสินค้าชุมชนที่คุณชื่นชอบแล้วเพิ่มลงในตะกร้าได้เลย</Text>
              <TouchableOpacity style={styles.shopNowBtn} onPress={() => router.push('/(tabs)/home')}>
                <Text style={styles.shopNowBtnText}>เลือกซื้อสินค้า</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )
      ) : (
        /* ================= 📦 โหมดผู้ขาย (Seller) ================= */
        sellerOrders.length > 0 ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 12 }}>
              {sellerOrders.map((order) => {
                const statusInfo = STATUS_CONFIG[order.status] || {
                  label: order.status,
                  color: '#475569',
                  bg: '#f1f5f9',
                };

                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.orderCard}
                    activeOpacity={0.85}
                    onPress={() => setSelectedOrder(order)}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.orderIdText}>คำสั่งซื้อ #{order.id.slice(0, 8)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                          {statusInfo.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    {order.items?.map((item: any, idx: number) => (
                      <View key={idx} style={styles.productRow}>
                        <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.productQty}>จำนวน: {item.quantity || 1} ชิ้น</Text>
                        </View>
                        <Text style={styles.productPrice}>฿ {(item.price || 0) * (item.quantity || 1)}</Text>
                      </View>
                    ))}

                    <View style={styles.divider} />

                    <View style={styles.cardFooter}>
                      <View>
                        <Text style={styles.totalLabel}>ยอดรวมสุทธิ</Text>
                        <Text style={styles.totalPrice}>฿ {(order.totalPrice || 0).toLocaleString()}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 13, color: '#1a5d3a', fontWeight: 'bold' }}>ตรวจสอบ / จัดการ</Text>
                        <Ionicons name="chevron-forward" size={16} color="#1a5d3a" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>ยังไม่มีคำสั่งซื้อจากลูกค้า</Text>
            </View>
          </ScrollView>
        )
      )}

      {/* 📄 Modal สำหรับผู้ขายกดตรวจสอบออเดอร์/สลิป */}
      <Modal visible={!!selectedOrder} transparent animationType="slide" onRequestClose={() => setSelectedOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>จัดการคำสั่งซื้อ</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedOrder(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 10 }}>
                
                {/* ที่อยู่ลูกค้า */}
                <View style={styles.detailCard}>
                  <Text style={styles.sectionHeaderTitle}>📍 ที่อยู่จัดส่งของลูกค้า</Text>
                  <Text style={styles.addressName}>{selectedOrder.shippingAddress?.fullName}</Text>
                  <Text style={styles.addressText}>{selectedOrder.shippingAddress?.address}</Text>
                  <Text style={styles.phoneText}>โทร: {selectedOrder.shippingAddress?.phone}</Text>
                </View>

                {/* สลิป */}
                {selectedOrder.slipImage && (
                  <View style={styles.detailCard}>
                    <Text style={styles.sectionHeaderTitle}>🧾 หลักฐานการโอนเงิน (สลิป)</Text>
                    <Image source={{ uri: selectedOrder.slipImage }} style={styles.slipFullImage} resizeMode="contain" />
                  </View>
                )}

                {/* ปุ่มการทำงานตามสถานะ */}
                {selectedOrder.status === 'waiting_approval' && (
                  <TouchableOpacity
                    style={styles.actionBtnApprove}
                    onPress={() => handleApproveSlip(selectedOrder.id)}
                  >
                    <Text style={styles.actionBtnText}>✅ ยืนยันสลิป / ยอดเงินถูกต้อง</Text>
                  </TouchableOpacity>
                )}

                {selectedOrder.status === 'paid' && (
                  <View style={[styles.detailCard, { gap: 8 }]}>
                    <Text style={styles.sectionHeaderTitle}>🚚 บันทึกข้อมูลการจัดส่ง</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="กรอกเลขพัสดุ หรือชื่อขนส่ง..."
                      value={trackingNumber}
                      onChangeText={setTrackingNumber}
                    />
                    <TouchableOpacity
                      style={styles.actionBtnShip}
                      onPress={() => handleShipOrder(selectedOrder.id)}
                    >
                      <Text style={styles.actionBtnText}>📦 ยืนยันการจัดส่งสินค้า</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedOrder.status === 'shipped' && (
                  <View style={styles.detailCard}>
                    <Text style={{ color: '#7e22ce', fontWeight: 'bold', textAlign: 'center' }}>
                      ✨ จัดส่งสินค้าแล้ว (เลขพัสดุ: {selectedOrder.trackingNumber || 'N/A'})
                    </Text>
                  </View>
                )}

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a5d3a', textAlign: 'center' },
  scrollContent: { padding: 20 },

  cartList: { gap: 12 },
  cartCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cartImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#f1f5f9' },
  cartInfo: { flex: 1, marginLeft: 12, gap: 4 },
  cartTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  cartPrice: { fontSize: 15, fontWeight: 'bold', color: '#1a5d3a' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  qtyText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  deleteBtn: { padding: 8 },

  checkoutFooter: { padding: 20, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, color: '#64748b' },
  totalPrice: { fontSize: 22, fontWeight: 'bold', color: '#1a5d3a' },
  checkoutBtn: { backgroundColor: '#1a5d3a', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  checkoutBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  shopNowBtn: { backgroundColor: '#1a5d3a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  shopNowBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

  orderCard: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderIdText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#f1f5f9' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productImage: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#f1f5f9' },
  productTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  productQty: { fontSize: 12, color: '#64748b' },
  productPrice: { fontSize: 14, fontWeight: 'bold', color: '#1a5d3a' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { width: '100%', backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  closeBtn: { padding: 4 },

  detailCard: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  sectionHeaderTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  addressName: { fontSize: 14, fontWeight: 'bold', color: '#1e3a8a' },
  addressText: { fontSize: 13, color: '#475569', lineHeight: 18 },
  phoneText: { fontSize: 12, color: '#64748b' },
  slipFullImage: { width: '100%', height: 260, borderRadius: 10, backgroundColor: '#e2e8f0' },
  textInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  actionBtnApprove: { backgroundColor: '#0284c7', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  actionBtnShip: { backgroundColor: '#7e22ce', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  actionBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
});