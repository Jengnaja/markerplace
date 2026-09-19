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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../services/firebase';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'all', name: 'ทั้งหมด' },
  { id: 'food', name: 'อาหาร' },
  { id: 'handicraft', name: 'หัตถกรรม' },
  { id: 'herb', name: 'สมุนไพร' },
  { id: 'processed', name: 'แปรรูป' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSeller, setIsSeller] = useState(false);

  // 🟢 ดึงข้อมูลสินค้าโดยรอยืนยัน Auth สถานะที่แน่นอน
  useFocusEffect(
    useCallback(() => {
      setLoading(true);

      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        try {
          let isUserSeller = false;

          if (user) {
            // 1. ตรวจสอบสิทธิ์ผู้ใช้ใน Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data() as any;
              const role = (userData?.role || userData?.userType || '').toString().toLowerCase();
              isUserSeller = role === 'seller' || userData?.isSeller === true;
            }
          }

          setIsSeller(isUserSeller);

          // 2. ดึงสินค้าทั้งหมดจากคอลเลกชัน products
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

          // 3. ถ้าเป็นคนขาย ให้เห็นเฉพาะสินค้าของตนเองเท่านั้น
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

  // 🔍 กรองสินค้า (รองรับหมวดหมู่ทั้งภาษาไทยและอังกฤษ)
  useEffect(() => {
    let result = products;

    // กรองตามหมวดหมู่ (รองรับทั้ง ID อังกฤษ และชื่อภาษาไทยใน Firestore)
    if (selectedCategory !== 'all') {
      result = result.filter((item) => {
        if (!item.category) return false;
        const catStr = item.category.toString().toLowerCase().trim();

        if (selectedCategory === 'food') return catStr === 'food' || catStr === 'อาหาร';
        if (selectedCategory === 'handicraft') return catStr === 'handicraft' || catStr === 'หัตถกรรม';
        if (selectedCategory === 'herb') return catStr === 'herb' || catStr === 'สมุนไพร';
        if (selectedCategory === 'processed') return catStr === 'processed' || catStr === 'แปรรูป';
        
        return catStr === selectedCategory;
      });
    }

    // กรองตามช่องค้นหา
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
              {isSeller ? 'ร้านค้าของคุณ 🏪' : 'ตลาดชุมชนออนไลน์ 🌾'}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
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
            {filteredProducts.map((item) => (
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
                  <View style={styles.productBottomRow}>
                    <Text style={styles.productPrice}>฿ {item.price}</Text>
                    <View style={styles.addToCartBtn}>
                      <Ionicons name="cart-outline" size={16} color="#ffffff" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
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
    marginBottom: 16,
    elevation: 2,
  },
  bannerImage: { width: '100%', height: '100%' },
  categoryScroll: { paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  categoryPill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  categoryPillActive: { backgroundColor: '#1a5d3a', borderColor: '#1a5d3a' },
  categoryText: { fontSize: 14, color: '#475569', fontWeight: '600' },
  categoryTextActive: { color: '#ffffff' },
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
  productInfo: { padding: 10, gap: 6 },
  productName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  productBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: 15, fontWeight: 'bold', color: '#1a5d3a' },
  addToCartBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a5d3a', justifyContent: 'center', alignItems: 'center' },
});