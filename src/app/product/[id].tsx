import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, getDocs, query, where, addDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const [rating, setRating] = useState<string>('5.0');
  const [reviewCount, setReviewCount] = useState<number>(0);

  // Modal แจ้งเตือน (เพิ่ม state สำหรับเช็คว่าเป็นกรณีต้องไปหน้า welcome หรือไม่)
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    actionType?: 'cart' | 'welcome';
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
    actionType: 'cart',
  });

  const showAlert = (
    type: 'success' | 'error' | 'warning',
    title: string,
    message: string,
    actionType: 'cart' | 'welcome' = 'cart'
  ) => {
    setAlertConfig({ visible: true, type, title, message, actionType });
  };

  useEffect(() => {
    const fetchProductDetail = async () => {
      if (!id) return;
      try {
        const prodDoc = await getDoc(doc(db, 'products', id as string));
        if (prodDoc.exists()) {
          const prodData = prodDoc.data();
          setProduct({ id: prodDoc.id, ...prodData });

          const randomRating = (Math.random() * (5.0 - 4.2) + 4.2).toFixed(1);
          const randomReviews = Math.floor(Math.random() * 116) + 5;
          setRating(randomRating);
          setReviewCount(randomReviews);

          if (prodData.sellerId) {
            const sellerDoc = await getDoc(doc(db, 'users', prodData.sellerId));
            if (sellerDoc.exists()) {
              setSeller(sellerDoc.data());
            }
          }
        }
      } catch (error) {
        console.log('Error fetching product details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetail();
  }, [id]);

  const increaseQuantity = () => setQuantity((prev) => prev + 1);
  const decreaseQuantity = () => { if (quantity > 1) setQuantity((prev) => prev - 1); };

  // 🛒 บันทึกสินค้าลง Firestore ตะกร้า
  const handleAddToCart = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      // 🟢 หากยังไม่ล็อกอิน ให้แสดง Modal และตั้งค่า actionType เป็น 'welcome'
      showAlert(
        'warning',
        'เข้าสู่ระบบ',
        'กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้าลงตะกร้า',
        'welcome'
      );
      return;
    }

    setAddingToCart(true);
    try {
      const cartQuery = query(
        collection(db, 'carts'),
        where('userId', '==', currentUser.uid),
        where('productId', '==', product.id)
      );
      const cartSnap = await getDocs(cartQuery);

      if (!cartSnap.empty) {
        const existingDoc = cartSnap.docs[0];
        const newQty = existingDoc.data().quantity + quantity;
        await updateDoc(doc(db, 'carts', existingDoc.id), {
          quantity: newQty,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'carts'), {
          userId: currentUser.uid,
          productId: product.id,
          title: product.title,
          price: product.price,
          image: product.image,
          sellerId: product.sellerId || '',
          quantity: quantity,
          createdAt: new Date().toISOString(),
        });
      }

      showAlert('success', 'สำเร็จ 🛒', `เพิ่ม "${product.title}" ลงตะกร้าแล้ว`, 'cart');
    } catch (error: any) {
      console.log('Error adding to cart:', error);
      showAlert('error', 'ข้อผิดพลาด', 'ไม่สามารถเพิ่มสินค้าลงตะกร้าได้', 'cart');
    } finally {
      setAddingToCart(false);
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
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Custom Modal */}
      <Modal
        transparent
        visible={alertConfig.visible}
        animationType="fade"
        onRequestClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Ionicons
              name={alertConfig.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
              size={56}
              color={
                alertConfig.type === 'success'
                  ? '#1a5d3a'
                  : alertConfig.type === 'warning'
                  ? '#f59e0b'
                  : '#d32f2f'
              }
            />
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => {
                setAlertConfig({ ...alertConfig, visible: false });
                // 🟢 ตรวจสอบเงื่อนไขการนำทางปุ่มใน Modal
                if (alertConfig.actionType === 'welcome') {
                  router.push('/welcome' as any);
                } else if (alertConfig.type === 'success') {
                  router.push('/(tabs)/cart');
                }
              }}
            >
              <Text style={styles.alertButtonText}>
                {alertConfig.actionType === 'welcome' ? 'เข้าสู่ระบบ / สมัครสมาชิก' : 'ดูตะกร้าสินค้า'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageCardContainer}>
          <Image source={{ uri: product.image }} style={styles.productImage} resizeMode="cover" />
          <TouchableOpacity style={styles.floatingBackButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatingHeartButton} onPress={() => setIsFavorite(!isFavorite)}>
            <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.productTitle}>{product.title}</Text>

          <View style={styles.priceRatingRow}>
            <Text style={styles.productPrice}>฿ {product.price}</Text>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={16} color="#eab308" />
              <Text style={styles.ratingText}>{rating}</Text>
              <Text style={styles.reviewCountText}>({reviewCount} รีวิว)</Text>
            </View>
          </View>

          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatarBox}>
              {seller?.profileImage ? (
                <Image source={{ uri: seller.profileImage }} style={styles.sellerAvatarImage} />
              ) : (
                <Ionicons name="person" size={22} color="#1a5d3a" />
              )}
            </View>
            <Text style={styles.sellerName} numberOfLines={2}>
              {seller?.fullName || 'กลุ่มวิสาหกิจชุมชนนนทบุรี'}
            </Text>
          </View>

          <Text style={styles.descriptionText}>
            {product.description || 'สินค้าคุณภาพจากชุมชน ผลิตด้วยภูมิปัญญาท้องถิ่น'}
          </Text>

          <View style={styles.quantitySection}>
            <Text style={styles.quantityLabel}>จำนวน</Text>
            <View style={styles.quantityControlPill}>
              <TouchableOpacity style={styles.qtyBtn} onPress={decreaseQuantity}>
                <Ionicons name="remove" size={18} color="#334155" />
              </TouchableOpacity>
              <Text style={styles.qtyNumberText}>{quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={increaseQuantity}>
                <Ionicons name="add" size={18} color="#1a5d3a" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addToCartButton, addingToCart && { backgroundColor: '#8cb89f' }]}
            onPress={handleAddToCart}
            disabled={addingToCart}
          >
            {addingToCart ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="cart-outline" size={22} color="#ffffff" />
                <Text style={styles.addToCartButtonText}>เพิ่มลงตะกร้า</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 30 },
  imageCardContainer: { width: width - 24, height: 280, alignSelf: 'center', marginTop: 10, borderRadius: 20, overflow: 'hidden', position: 'relative', backgroundColor: '#f1f5f9' },
  productImage: { width: '100%', height: '100%' },
  floatingBackButton: { position: 'absolute', top: 14, left: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  floatingHeartButton: { position: 'absolute', top: 14, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  detailsContainer: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
  productTitle: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  priceRatingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: 24, fontWeight: 'bold', color: '#1a5d3a' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 15, fontWeight: 'bold', color: '#eab308' },
  reviewCountText: { fontSize: 14, color: '#94a3b8' },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerAvatarBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  sellerAvatarImage: { width: '100%', height: '100%' },
  sellerName: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#1a5d3a' },
  descriptionText: { fontSize: 14, color: '#475569', lineHeight: 22 },
  quantitySection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  quantityLabel: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  quantityControlPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 25, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: '#f8fafc', gap: 16 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', elevation: 1 },
  qtyNumberText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  addToCartButton: { flexDirection: 'row', backgroundColor: '#1a5d3a', height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  addToCartButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  alertBox: { width: '80%', backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center', gap: 12 },
  alertTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  alertMessage: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  alertButton: { backgroundColor: '#1a5d3a', width: '100%', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  alertButtonText: { color: '#ffffff', fontWeight: 'bold' },
});