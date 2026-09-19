import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../services/firebase';

const CATEGORIES = [
  { id: 'all', name: 'ทั้งหมด' },
  { id: 'food', name: 'อาหาร' },
  { id: 'handicraft', name: 'หัตถกรรม' },
  { id: 'herb', name: 'สมุนไพร' },
  { id: 'processed', name: 'แปรรูป' },
];

export default function ProductsTabScreen() {
  const router = useRouter();

  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSeller, setIsSeller] = useState(false);

  // 🟢 ดึงข้อมูลสินค้า แยกสิทธิ์การเห็นของ "ผู้ซื้อ" และ "ผู้ขาย"
  useFocusEffect(
    useCallback(() => {
      setLoading(true);

      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        try {
          let isUserSeller = false;

          if (user) {
            // 1. ตรวจสอบบทบาทผู้ใช้จาก Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data() as any;
              const roleStr = (
                userData?.role ||
                userData?.userType ||
                userData?.type ||
                ''
              ).toString().toLowerCase();

              isUserSeller =
                roleStr === 'seller' ||
                roleStr === 'ร้านค้า' ||
                userData?.isSeller === true;
            }
          }

          setIsSeller(isUserSeller);

          // 2. ดึงรายการสินค้าทั้งหมดพร้อมชื่อร้านค้าผู้ขาย
          const querySnapshot = await getDocs(collection(db, 'products'));
          const productList: any[] = [];

          for (const docSnap of querySnapshot.docs) {
            const prodData = docSnap.data() as any;
            let sellerName = 'กลุ่มวิสาหกิจชุมชน';

            const ownerId =
              prodData.sellerId ||
              prodData.userId ||
              prodData.ownerId ||
              prodData.uid ||
              prodData.createdBy;

            if (ownerId) {
              try {
                const sellerDoc = await getDoc(doc(db, 'users', ownerId));
                if (sellerDoc.exists() && sellerDoc.data().fullName) {
                  sellerName = sellerDoc.data().fullName;
                }
              } catch (err) {
                console.log('Error fetching seller:', err);
              }
            }

            const validImage =
              typeof prodData.image === 'string' && !prodData.image.startsWith('file://')
                ? prodData.image
                : 'https://via.placeholder.com/150';

            productList.push({
              id: docSnap.id,
              ...prodData,
              image: validImage,
              sellerName,
              ownerId,
            });
          }

          // 3. กรองสิทธิ์: ผู้ขายเห็นเฉพาะของตนเอง / ผู้ซื้อเห็นทั้งหมด
          if (isUserSeller && user) {
            const myProducts = productList.filter(
              (item) => item.ownerId === user.uid
            );
            setProducts(myProducts);
          } else {
            setProducts(productList);
          }
        } catch (error) {
          console.log('Error fetching products:', error);
        } finally {
          setLoading(false);
        }
      });

      return () => unsubscribeAuth();
    }, [])
  );

  // 🔍 กรองสินค้าตามคำค้นหาและหมวดหมู่
  useEffect(() => {
    let result = products;

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

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(query) ||
          item.name?.toLowerCase().includes(query) ||
          item.sellerName?.toLowerCase().includes(query)
      );
    }

    setFilteredProducts(result);
  }, [searchQuery, selectedCategory, products]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9f5" />

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>
          {isSeller ? 'จัดการสินค้าในร้าน 📦' : 'สินค้าทั้งหมด 📦'}
        </Text>
      </View>

      {/* 🔍 ช่องค้นหา */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={isSeller ? 'ค้นหาสินค้าในร้านของคุณ...' : 'ค้นหาสินค้า...'}
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
      </View>

      {/* 📂 หมวดหมู่สินค้า */}
      <View style={styles.categoryRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item.id;
            return (
              <TouchableOpacity
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(item.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* 📦 รายการสินค้า */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a5d3a" />
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="basket-outline" size={56} color="#cbd5e1" />
          <Text style={styles.emptyText}>
            {isSeller ? 'คุณยังไม่มีสินค้าในร้านค้าของคุณ' : 'ไม่พบสินค้าที่ค้นหา'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productCard}
              activeOpacity={0.85}
              onPress={() => {
                if (isSeller) {
                  router.push({ pathname: '/edit-product', params: { id: item.id } } as any);
                } else {
                  router.push(`/product/${item.id}` as any);
                }
              }}
            >
              <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />

              <View style={styles.productDetails}>
                <Text style={styles.productTitle} numberOfLines={1}>
                  {item.title || item.name}
                </Text>
                <Text style={styles.sellerName} numberOfLines={1}>{item.sellerName}</Text>
                <Text style={styles.productPrice}>฿ {item.price}</Text>
              </View>

              {/* ✏️ สลับปุ่มระหว่าง "แก้ไข" (ฝั่งผู้ขาย) และ "ตะกร้า" (ฝั่งผู้ซื้อ) */}
              {isSeller ? (
                <TouchableOpacity
                  style={styles.editBtn}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push({ pathname: '/edit-product', params: { id: item.id } } as any)
                  }
                >
                  <Ionicons name="create-outline" size={20} color="#1a5d3a" />
                  <Text style={styles.editBtnText}>แก้ไข</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.cartBtn}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/product/${item.id}` as any)}
                >
                  <Ionicons name="cart-outline" size={22} color="#1a5d3a" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#faf9f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 15, color: '#64748b' },
  headerRow: { paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a5d3a' },
  searchWrapper: { paddingHorizontal: 16, marginBottom: 14 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 25, paddingHorizontal: 16, height: 46, borderWidth: 1, borderColor: '#e2e8f0' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  categoryRow: { marginBottom: 14 },
  categoryPill: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f1eb' },
  categoryPillActive: { backgroundColor: '#1a5d3a' },
  categoryText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  categoryTextActive: { color: '#ffffff' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, padding: 12, borderWidth: 1, borderColor: '#f1f5f9', elevation: 2 },
  productImage: { width: 86, height: 86, borderRadius: 16, backgroundColor: '#f1f5f9' },
  productDetails: { flex: 1, marginLeft: 14, justifyContent: 'center', gap: 4 },
  productTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  sellerName: { fontSize: 12, color: '#64748b' },
  productPrice: { fontSize: 16, fontWeight: 'bold', color: '#1a5d3a', marginTop: 2 },
  cartBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  /* ✏️ สไตล์ปุ่มแก้ไข */
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1a5d3a',
  },
}); 