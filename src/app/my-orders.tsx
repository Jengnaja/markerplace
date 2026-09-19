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
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

// 🟢 ตัวแปลงสถานะคำสั่งซื้อเป็นภาษาไทย + สี Badge
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'รอชำระเงิน', color: '#d97706', bg: '#fef3c7' },
  waiting_approval: { label: 'รอตรวจสอบสลิป', color: '#0284c7', bg: '#e0f2fe' },
  paid: { label: 'กำลังเตรียมจัดส่ง', color: '#15803d', bg: '#dcfce7' },
  shipped: { label: 'อยู่ระหว่างจัดส่ง', color: '#7e22ce', bg: '#f3e8ff' },
  completed: { label: 'สำเร็จแล้ว', color: '#16a34a', bg: '#dcfce7' },
};

export default function MyOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // 🟢 ดึงข้อมูลคำสั่งซื้อของผู้ใช้ปัจจุบัน
  useFocusEffect(
    useCallback(() => {
      const fetchMyOrders = async () => {
        setLoading(true);
        const currentUser = auth.currentUser;

        if (currentUser) {
          try {
            const q = query(collection(db, 'orders'), where('userId', '==', currentUser.uid));
            const querySnapshot = await getDocs(q);
            const list: any[] = [];
            querySnapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() });
            });

            // เรียงลำดับจากออเดอร์ล่าสุดขึ้นก่อน
            list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setOrders(list);
          } catch (error) {
            console.log('Error fetching my orders:', error);
          }
        }
        setLoading(false);
      };

      fetchMyOrders();
    }, [])
  );

  // 📦 กดปุ่มยืนยันการรับสินค้า
  const handleConfirmReceived = async (orderId: string) => {
    Alert.alert('ยืนยันการรับสินค้า', 'คุณได้รับสินค้าถูกต้องและครบถ้วนแล้วใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'orders', orderId), { status: 'completed' });
            setOrders((prev) =>
              prev.map((ord) => (ord.id === orderId ? { ...ord, status: 'completed' } : ord))
            );
            if (selectedOrder && selectedOrder.id === orderId) {
              setSelectedOrder((prev: any) => ({ ...prev, status: 'completed' }));
            }
          } catch (error) {
            console.log('Error updating order status:', error);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9f5" />

      {/* 🟢 Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>สถานะคำสั่งซื้อของฉัน 📦</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bag-handle-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>ยังไม่มีรายการสั่งซื้อ</Text>
            <Text style={styles.emptySub}>คุณยังไม่ได้สั่งซื้อสินค้าใดๆ ในขณะนี้</Text>
            <TouchableOpacity style={styles.shopNowBtn} onPress={() => router.push('/(tabs)/home')}>
              <Text style={styles.shopNowBtnText}>ไปเลือกซื้อสินค้า</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((order) => {
            const statusInfo = STATUS_CONFIG[order.status] || {
              label: 'รอดำเนินการ',
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
                {/* Header การ์ด */}
                <View style={styles.cardHeader}>
                  <Text style={styles.orderIdText}>คำสั่งซื้อ #{order.id.slice(0, 8)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* รายการสินค้าในออเดอร์ */}
                {order.items && order.items.length > 0 ? (
                  order.items.map((item: any, idx: number) => (
                    <View key={idx} style={styles.productRow}>
                      <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.productQty}>จำนวน: {item.quantity || 1} ชิ้น</Text>
                      </View>
                      <Text style={styles.productPrice}>฿ {(item.price || 0) * (item.quantity || 1)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: '#64748b', fontSize: 13 }}>ไม่พบรายละเอียดสินค้า</Text>
                )}

                <View style={styles.divider} />

                {/* สรุปรวม & ปุ่มดูรายละเอียด */}
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.totalLabel}>ยอดรวมสุทธิ</Text>
                    <Text style={styles.totalPrice}>฿ {(order.totalPrice || 0).toLocaleString()}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 13, color: '#1a5d3a', fontWeight: 'bold' }}>ดูรายละเอียด</Text>
                    <Ionicons name="chevron-forward" size={16} color="#1a5d3a" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* 📄 Modal แสดงรายละเอียดคำสั่งซื้อแบบเจาะลึก */}
      <Modal visible={!!selectedOrder} transparent animationType="slide" onRequestClose={() => setSelectedOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>รายละเอียดคำสั่งซื้อ</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedOrder(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 10 }}>
                {/* สถานะคำสั่งซื้อ */}
                <View style={styles.detailCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.detailLabel}>สถานะ</Text>
                    <View style={[styles.statusBadge, { backgroundColor: (STATUS_CONFIG[selectedOrder.status] || {}).bg || '#f1f5f9' }]}>
                      <Text style={[styles.statusText, { color: (STATUS_CONFIG[selectedOrder.status] || {}).color || '#475569' }]}>
                        {(STATUS_CONFIG[selectedOrder.status] || {}).label || 'รอดำเนินการ'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.detailSubText}>รหัสคำสั่งซื้อ: #{selectedOrder.id}</Text>
                  <Text style={styles.detailSubText}>
                    วันที่สั่งซื้อ: {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('th-TH') : '-'}
                  </Text>
                </View>

                {/* ที่อยู่จัดส่ง */}
                <View style={styles.detailCard}>
                  <Text style={styles.sectionHeaderTitle}>📍 ที่อยู่จัดส่ง</Text>
                  <Text style={styles.addressName}>{selectedOrder.shippingAddress?.fullName || '-'}</Text>
                  <Text style={styles.addressText}>{selectedOrder.shippingAddress?.address || '-'}</Text>
                  <Text style={styles.phoneText}>โทร: {selectedOrder.shippingAddress?.phone || '-'}</Text>
                </View>

                {/* รายการสินค้า */}
                <View style={styles.detailCard}>
                  <Text style={styles.sectionHeaderTitle}>🛍️ รายการสินค้า</Text>
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <View key={idx} style={styles.productRow}>
                      <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.productTitle}>{item.title}</Text>
                        <Text style={styles.productQty}>฿ {item.price} x {item.quantity || 1}</Text>
                      </View>
                      <Text style={styles.productPrice}>฿ {(item.price || 0) * (item.quantity || 1)}</Text>
                    </View>
                  ))}
                </View>

                {/* การจัดส่งและการชำระเงิน */}
                <View style={styles.detailCard}>
                  <Text style={styles.sectionHeaderTitle}>💳 ข้อมูลการจัดส่งและการชำระเงิน</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>วิธีการจัดส่ง:</Text>
                    <Text style={styles.infoValue}>{selectedOrder.shippingMethod || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>วิธีการชำระเงิน:</Text>
                    <Text style={styles.infoValue}>{selectedOrder.paymentMethod || '-'}</Text>
                  </View>
                  {selectedOrder.slipImage && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.infoLabel}>หลักฐานการโอนเงิน:</Text>
                      <Image source={{ uri: selectedOrder.slipImage }} style={styles.slipImagePreview} resizeMode="cover" />
                    </View>
                  )}
                </View>

                {/* สรุปยอดเงิน */}
                <View style={styles.detailCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>ค่าสินค้า:</Text>
                    <Text style={styles.infoValue}>฿ {(selectedOrder.subtotalPrice || 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>ค่าจัดส่ง:</Text>
                    <Text style={styles.infoValue}>฿ {(selectedOrder.shippingFee || 0).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.infoRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' }]}>
                    <Text style={styles.totalLabelBold}>ยอดชำระสุทธิ:</Text>
                    <Text style={styles.totalPriceBold}>฿ {(selectedOrder.totalPrice || 0).toLocaleString()}</Text>
                  </View>
                </View>

                {/* ปุ่ม Action ภายใน Modal */}
                {selectedOrder.status === 'pending_payment' && (
                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => {
                      const ord = selectedOrder;
                      setSelectedOrder(null);
                      router.push({
                        pathname: '/payment',
                        params: { orderId: ord.id, amount: ord.totalPrice?.toString() },
                      });
                    }}
                  >
                    <Text style={styles.modalActionBtnText}>ไปหน้าชำระเงิน</Text>
                  </TouchableOpacity>
                )}

                {selectedOrder.status === 'shipped' && (
                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => handleConfirmReceived(selectedOrder.id)}
                  >
                    <Text style={styles.modalActionBtnText}>ได้รับสินค้าแล้ว</Text>
                  </TouchableOpacity>
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
  safeArea: { flex: 1, backgroundColor: '#faf9f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30, gap: 14 },

  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderIdText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#f1f5f9' },

  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productImage: { width: 54, height: 54, borderRadius: 10, backgroundColor: '#f1f5f9' },
  productTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  productQty: { fontSize: 12, color: '#64748b' },
  productPrice: { fontSize: 14, fontWeight: 'bold', color: '#1a5d3a' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  totalLabel: { fontSize: 12, color: '#64748b' },
  totalPrice: { fontSize: 18, fontWeight: 'bold', color: '#1a5d3a' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  emptySub: { fontSize: 14, color: '#64748b' },
  shopNowBtn: { backgroundColor: '#1a5d3a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 10 },
  shopNowBtnText: { color: '#ffffff', fontWeight: 'bold' },

  /* Modal Details */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  closeBtn: { padding: 4 },

  detailCard: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  detailLabel: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  detailSubText: { fontSize: 12, color: '#64748b' },
  sectionHeaderTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  addressName: { fontSize: 14, fontWeight: 'bold', color: '#1e3a8a' },
  addressText: { fontSize: 13, color: '#475569', lineHeight: 18 },
  phoneText: { fontSize: 12, color: '#64748b' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13, color: '#64748b' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  totalLabelBold: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  totalPriceBold: { fontSize: 18, fontWeight: 'bold', color: '#1a5d3a' },

  slipImagePreview: { width: 120, height: 160, borderRadius: 10, marginTop: 6 },

  modalActionBtn: { backgroundColor: '#1a5d3a', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  modalActionBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
});