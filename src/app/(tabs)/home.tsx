import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../services/firebase';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'all', name: 'ทั้งหมด', icon: 'grid-outline' },
  { id: 'processed', name: 'สินค้าแปรรูป', icon: 'cube-outline' },
  { id: 'food', name: 'อาหาร', icon: 'restaurant-outline' },
  { id: 'handicraft', name: 'หัตถกรรม', icon: 'color-palette-outline' },
  { id: 'herb', name: 'สมุนไพร', icon: 'leaf-outline' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSeller, setIsSeller] = useState(false);

  // 🟢 ตรวจสอบสถานะการล็อกอินและตั้งเวลา 5 วินาที (ถ้ายังไม่ล็อกอิน ให้ไปหน้า welcome)
  useEffect(() => {
    let isMounted = true;

    const timeoutId = setTimeout(() => {
      if (isMounted && !auth.currentUser) {
        router.replace('/welcome' as any);
      }
    }, 5000);

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user && isMounted) {
        // หากตรวจพบทันทีว่าไม่อยู่ในระบบ
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      unsubscribeAuth();
    };
  }, []);

  // 🟢 1. ระบบอัปเดตสถานะออนไลน์ (isOnline & lastSeen)
  useEffect(() => {
    const updateStatus = async (status: boolean) => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, {
            isOnline: status,
            lastSeen: serverTimestamp(),
          });
        } catch (error) {
          console.log('Error updating online status:', error);
        }
      }
    };

    updateStatus(true);

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        updateStatus(true);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        updateStatus(false);
      }
    });

    return () => {
      updateStatus(false);
      subscription.remove();
    };
  }, []);

  // 🟢 2. ดึงข้อมูลสินค้าและสิทธิ์ผู้ใช้
  useFocusEffect(
    useCallback(() => {
      setLoading(true);

      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        try {
          let isUserSeller = false;

          if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data() as any;
              const role = (userData?.role || userData?.userType || '').toString().toLowerCase();
              isUserSeller = role === 'seller' || userData?.isSeller === true;
            }
          }

          setIsSeller(isUserSeller);

          const querySnapshot = await getDocs(collection(db, 'products'));
          let productList: any[] = [];

          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;

            const validImage =
              typeof data.image === 'string' && !data.image.startsWith('file://')
                ? data.image
                : 'https://via.placeholder.com/150';

            productList.push({
              id: docSnap.id,
              ...data,
              image: validImage,
            });
          });

          if (isUserSeller && user) {
            productList = productList.filter((item) => {
              const ownerId = item.sellerId || item.userId || item.ownerId || item.uid || item.sellerUid;
              return ownerId === user.uid;
            });
          }

          setProducts(productList);
        } catch (error) {
          console.log('Error fetching home products:', error);
        } finally {
          setLoading(false);
        }
      });

      return () => unsubscribeAuth();
    }, [])
  );

  // 🔍 กรองสินค้าตามหมวดหมู่และคำค้นหา
  useEffect(() => {
    let result = products;

    if (selectedCategory !== 'all') {
      result = result.filter((item) => {
        if (!item.category) return false;
        const catStr = item.category.toString().toLowerCase().trim();

        if (selectedCategory === 'food') return catStr === 'food' || catStr === 'อาหาร';
        if (selectedCategory === 'handicraft') return catStr === 'handicraft' || catStr === 'หัตถกรรม';
        if (selectedCategory === 'herb') return catStr === 'herb' || catStr === 'สมุนไพร';
        if (selectedCategory === 'processed') return catStr === 'processed' || catStr === 'แปรรูป' || catStr === 'สินค้าแปรรูป';
        
        return catStr === selectedCategory;
      });
    }

    if (searchQuery.trim() !== '') {
      const queryStr = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const titleMatch = item.title?.toLowerCase().includes(queryStr);
        const nameMatch = item.name?.toLowerCase().includes(queryStr);
        return titleMatch || nameMatch;
      });
    }

    setFilteredProducts(result);
  }, [searchQuery, selectedCategory, products]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9f5" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcomeSubtext}>ยินดีต้อนรับสู่</Text>
            <Text style={styles.appName}>
              {isSeller ? 'ร้านค้าของคุณ 🏪' : 'วิสาหกิจชุมชนนนทบุรี'}
            </Text>
          </View>
        </View>

        {/* ช่องค้นหา */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={isSeller ? 'ค้นหาสินค้าในร้านของคุณ...' : 'ค้นหาสินค้าชุมชน...'}
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* แบนเนอร์ commu.png */}
        <View style={styles.bannerWrapper}>
          <Image
            source={require('../../../assets/images/commu.png')}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        </View>

        {/* แถบเลือกหมวดหมู่ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryItem}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.categoryIconBox,
                    isSelected ? styles.categoryIconBoxActive : styles.categoryIconBoxInactive,
                  ]}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={26}
                    color={isSelected ? '#b45309' : '#1a5d3a'}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected && styles.categoryLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* หัวข้อรายการสินค้า */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {isSeller ? 'รายการสินค้าของคุณ 📦' : 'สินค้ายอดนิยม 🌟'}
          </Text>
          <TouchableOpacity onPress={() => router.push('/all-products' as any)}>
            <Text style={styles.seeAllText}>ดูทั้งหมด &gt;</Text>
          </TouchableOpacity>
        </View>

        {/* Grid รายการสินค้า */}
        {loading ? (
          <ActivityIndicator size="large" color="#1a5d3a" style={{ marginTop: 30 }} />
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="basket-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>
              {isSeller ? 'ยังไม่มีสินค้าในร้านของคุณ' : 'ไม่พบสินค้าในหมวดหมู่นี้'}
            </Text>
          </View>
        ) : (
          <View style={styles.productGrid}>
            {filteredProducts.map((item) => {
              // 🟢 คำนวณจำนวนคงเหลือในสต็อก (เช็กฟิลด์ stock หรือ quantity)
              const currentStock = item.stock !== undefined 
                ? Number(item.stock) 
                : (item.quantity !== undefined ? Number(item.quantity) : 0);

              const isOutOfStock = currentStock <= 0;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.productCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/product/${item.id}` as any)}
                >
                  <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.title || item.name}
                    </Text>

                    {/* 🟢 แสดงจำนวนสินค้าคงเหลือ */}
                    <Text style={[styles.productStockText, isOutOfStock && styles.outOfStockText]}>
                      {!isOutOfStock ? `เหลือ ${currentStock} ชิ้น` : 'สินค้าหมด'}
                    </Text>

                    <View style={styles.productBottomRow}>
                      <Text style={styles.productPrice}>฿ {item.price}</Text>
                      <View style={[styles.addToCartBtn, isOutOfStock && styles.disabledCartBtn]}>
                        <Ionicons name="cart-outline" size={16} color="#ffffff" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#faf9f5' },
  scrollContent: { paddingBottom: 30 },
  headerRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  welcomeSubtext: { fontSize: 13, color: '#64748b' },
  appName: { fontSize: 22, fontWeight: 'bold', color: '#1a5d3a' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  bannerWrapper: {
    width: width - 40,
    height: 150,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 2,
  },
  bannerImage: { width: '100%', height: '100%' },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  categoryItem: {
    alignItems: 'center',
    width: 68,
    gap: 6,
  },
  categoryIconBox: {
    width: 58,
    height: 58,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIconBoxInactive: {
    backgroundColor: '#dcfce7',
  },
  categoryIconBoxActive: {
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: '#b45309',
    fontWeight: 'bold',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  seeAllText: { fontSize: 14, color: '#1a5d3a', fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: '#94a3b8' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14 },
  productCard: {
    width: (width - 48) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 5,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
  },
  productImage: { width: '100%', height: 130, backgroundColor: '#f1f5f9' },
  productInfo: { padding: 10, gap: 4 },
  productName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  productStockText: { fontSize: 11, color: '#64748b', fontWeight: '500' }, // 🟢 Style สำหรับแสดงสต็อกคงเหลือ
  outOfStockText: { color: '#ef4444', fontWeight: 'bold' }, // 🟢 Style กรณีสินค้าหมด
  productBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  productPrice: { fontSize: 15, fontWeight: 'bold', color: '#1a5d3a' },
  addToCartBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a5d3a', justifyContent: 'center', alignItems: 'center' },
  disabledCartBtn: { backgroundColor: '#cbd5e1' },
});