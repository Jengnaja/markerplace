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
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
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

  // Modal แจ้งเตือน
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    actionType?: 'cart' | 'welcome' | 'close';
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
    actionType: 'cart' | 'welcome' | 'close' = 'cart'
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

  // คำนวณจำนวนคงเหลือในสต็อก
  const availableStock = product?.stock !== undefined 
    ? Number(product.stock) 
    : (product?.quantity !== undefined ? Number(product.quantity) : 0);

  const isOutOfStock = availableStock <= 0;

  // ฟังก์ชันปรับจำนวนสินค้า
  const increaseQuantity = () => {
    if (quantity < availableStock) {
      setQuantity((prev) => prev + 1);
    } else {
      showAlert('warning', 'ข้อจำกัดสินค้า', `สินค้าในคลังมีเพียง ${availableStock} ชิ้นเท่านั้น`, 'close');
    }
  };

  const decreaseQuantity = () => { 
    if (quantity > 1) setQuantity((prev) => prev - 1); 
  };

  // 💬 ฟังก์ชันจัดการเมื่อกดปุ่มแชท
const handleChatWithSeller = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showAlert('warning', 'เข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนเริ่มแชทกับร้านค้า', 'welcome');
    return;
  }

  const sellerId = product?.sellerId;
  if (!sellerId) {
    showAlert('warning', 'ข้อผิดพลาด', 'ไม่พบข้อมูลร้านค้า', 'close');
    return;
  }

  if (currentUser.uid === sellerId) {
    showAlert('warning', 'ข้อแจ้งเตือน', 'คุณไม่สามารถแชทกับร้านค้าของตัวเองได้', 'close');
    return;
  }

  try {
    // ดึงข้อมูลโปรไฟล์ของลูกค้าปัจจุบัน
    const buyerDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const buyerData = buyerDoc.exists() ? buyerDoc.data() : null;

    const chatId = `${currentUser.uid}_${sellerId}`;
    const chatRef = doc(db, 'chats', chatId);

    // บันทึก/อัปเดตข้อมูลห้องแชทพร้อมรูปโปรไฟล์ทั้งสองฝั่ง
    await setDoc(
      chatRef,
      {
        chatId: chatId,
        participants: [currentUser.uid, sellerId],
        buyerId: currentUser.uid,
        sellerId: sellerId,
        sellerName: seller?.fullName || 'ร้านค้าชุมชน',
        sellerImage: seller?.profileImage || seller?.avatar || '',
        buyerName: buyerData?.fullName || currentUser.displayName || 'ลูกค้า',
        buyerImage: buyerData?.profileImage || currentUser.photoURL || '',
        lastMessage: 'เริ่มการสนทนา',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    router.push({
      pathname: '/chat/room' as any,
      params: {
        chatId: chatId,
        sellerName: seller?.fullName || 'ร้านค้าชุมชน',
        sellerImage: seller?.profileImage || '',
        buyerImage: buyerData?.profileImage || '',
        productId: product?.id,
        productTitle: product?.title,
        productPrice: product?.price,
        productImage: product?.image,
      },
    });
  } catch (error) {
    console.log('Error opening chat room:', error);
    showAlert('error', 'ข้อผิดพลาด', 'ไม่สามารถเปิดห้องแชทได้', 'close');
  }
};
  // 🛒 บันทึกสินค้าลง Firestore ตะกร้า
  const handleAddToCart = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showAlert(
        'warning',
        'เข้าสู่ระบบ',
        'กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้าลงตะกร้า',
        'welcome'
      );
      return;
    }

    if (isOutOfStock) {
      showAlert('warning', 'สินค้าหมด', 'ขออภัย สินค้ารายการนี้หมดชั่วคราว', 'close');
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
        const currentInCart = existingDoc.data().quantity || 0;
        const newQty = currentInCart + quantity;

        if (newQty > availableStock) {
          showAlert('warning', 'สินค้าเกินสต็อก', `คุณมีสินค้านี้ในตะกร้าแล้ว ${currentInCart} ชิ้น ไม่สามารถเพิ่มเกินจำนวนคงเหลือ (${availableStock} ชิ้น) ได้`, 'close');
          setAddingToCart(false);
          return;
        }

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
                if (alertConfig.actionType === 'welcome') {
                  router.push('/welcome' as any);
                } else if (alertConfig.actionType === 'cart') {
                  router.push('/(tabs)/cart');
                }
              }}
            >
              <Text style={styles.alertButtonText}>
                {alertConfig.actionType === 'welcome' 
                  ? 'เข้าสู่ระบบ / สมัครสมาชิก' 
                  : alertConfig.actionType === 'cart' 
                  ? 'ดูตะกร้าสินค้า' 
                  : 'ตกลง'}
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
            <View>
              <Text style={styles.productPrice}>฿ {product.price}</Text>
              <Text style={[styles.stockStatusText, isOutOfStock && styles.outOfStockStatusText]}>
                {!isOutOfStock ? `คลัง: ${availableStock} ชิ้น` : '❌ สินค้าหมดชั่วคราว'}
              </Text>
            </View>

            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={16} color="#eab308" />
              <Text style={styles.ratingText}>{rating}</Text>
              <Text style={styles.reviewCountText}>({reviewCount} รีวิว)</Text>
            </View>
          </View>

          {/* การ์ดข้อมูลร้านค้า พร้อมปุ่มแชท */}
          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatarBox}>
              {seller?.profileImage ? (
                <Image source={{ uri: seller.profileImage }} style={styles.sellerAvatarImage} />
              ) : (
                <Ionicons name="person" size={22} color="#1a5d3a" />
              )}
            </View>
            <View style={styles.sellerInfoText}>
              <Text style={styles.sellerName} numberOfLines={1}>
                {seller?.fullName || 'กลุ่มวิสาหกิจชุมชนนนทบุรี'}
              </Text>
              <Text style={styles.sellerSubText}>ตอบกลับอย่างรวดเร็ว</Text>
            </View>

            <TouchableOpacity style={styles.chatSellerBtn} onPress={handleChatWithSeller}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#1a5d3a" />
              <Text style={styles.chatSellerBtnText}>แชทเลย</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.descriptionText}>
            {product.description || 'สินค้าคุณภาพจากชุมชน ผลิตด้วยภูมิปัญญาท้องถิ่น'}
          </Text>

          {/* ส่วนปรับจำนวนสินค้า */}
          <View style={styles.quantitySection}>
            <View>
              <Text style={styles.quantityLabel}>จำนวน</Text>
              <Text style={styles.stockHintText}>(มีสินค้าคงเหลือ {availableStock} ชิ้น)</Text>
            </View>
            <View style={styles.quantityControlPill}>
              <TouchableOpacity 
                style={[styles.qtyBtn, (quantity <= 1 || isOutOfStock) && styles.disabledQtyBtn]} 
                onPress={decreaseQuantity}
                disabled={quantity <= 1 || isOutOfStock}
              >
                <Ionicons name="remove" size={18} color={quantity <= 1 || isOutOfStock ? '#cbd5e1' : '#334155'} />
              </TouchableOpacity>

              <Text style={styles.qtyNumberText}>{isOutOfStock ? 0 : quantity}</Text>

              <TouchableOpacity 
                style={[styles.qtyBtn, (quantity >= availableStock || isOutOfStock) && styles.disabledQtyBtn]} 
                onPress={increaseQuantity}
                disabled={quantity >= availableStock || isOutOfStock}
              >
                <Ionicons name="add" size={18} color={quantity >= availableStock || isOutOfStock ? '#cbd5e1' : '#1a5d3a'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* แถบปุ่มด้านล่างแบบ Shopee (ปุ่มแชท + ปุ่มเพิ่มลงตะกร้า) */}
          <View style={styles.bottomActionRow}>
            <TouchableOpacity 
              style={styles.chatBottomBtn} 
              onPress={handleChatWithSeller}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#1a5d3a" />
              <Text style={styles.chatBottomBtnText}>แชท</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.addToCartButton, 
                (addingToCart || isOutOfStock) && { backgroundColor: '#cbd5e1' }
              ]}
              onPress={handleAddToCart}
              disabled={addingToCart || isOutOfStock}
              activeOpacity={0.8}
            >
              {addingToCart ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="cart-outline" size={22} color="#ffffff" />
                  <Text style={styles.addToCartButtonText}>
                    {isOutOfStock ? 'สินค้าหมด' : 'เพิ่มลงตะกร้า'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  priceRatingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  productPrice: { fontSize: 24, fontWeight: 'bold', color: '#1a5d3a' },
  stockStatusText: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 2 },
  outOfStockStatusText: { color: '#ef4444', fontWeight: 'bold' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 15, fontWeight: 'bold', color: '#eab308' },
  reviewCountText: { fontSize: 14, color: '#94a3b8' },
  
  // Styles ร้านค้า
  sellerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  sellerAvatarBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 10 },
  sellerAvatarImage: { width: '100%', height: '100%' },
  sellerInfoText: { flex: 1, marginRight: 8 },
  sellerName: { fontSize: 15, fontWeight: 'bold', color: '#1a5d3a' },
  sellerSubText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  chatSellerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#1a5d3a', backgroundColor: '#f0fdf4' },
  chatSellerBtnText: { fontSize: 13, fontWeight: 'bold', color: '#1a5d3a' },

  descriptionText: { fontSize: 14, color: '#475569', lineHeight: 22 },
  quantitySection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  quantityLabel: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  stockHintText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  quantityControlPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 25, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: '#f8fafc', gap: 16 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', elevation: 1 },
  disabledQtyBtn: { backgroundColor: '#f1f5f9', elevation: 0 },
  qtyNumberText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },

  // Styles แถบปุ่มด้านล่าง (Shopee Style)
  bottomActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  chatBottomBtn: { width: 64, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: '#1a5d3a', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4' },
  chatBottomBtnText: { fontSize: 11, fontWeight: 'bold', color: '#1a5d3a', marginTop: 1 },
  addToCartButton: { flex: 1, flexDirection: 'row', backgroundColor: '#1a5d3a', height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', gap: 8 },
  addToCartButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  alertBox: { width: '80%', backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center', gap: 12 },
  alertTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  alertMessage: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  alertButton: { backgroundColor: '#1a5d3a', width: '100%', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  alertButtonText: { color: '#ffffff', fontWeight: 'bold' },
});