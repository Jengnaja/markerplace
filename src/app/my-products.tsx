import React, { useState, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

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

  // 🟢 ดึงข้อมูลสินค้าพร้อมชื่อร้านค้าผู้ขายจาก Firestore
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        const productList: any[] = [];

        for (const docSnap of querySnapshot.docs) {
          const prodData = docSnap.data();
          let sellerName = 'กลุ่มวิสาหกิจชุมชน';

          if (prodData.sellerId) {
            try {
              const sellerDoc = await getDoc(doc(db, 'users', prodData.sellerId));
              if (sellerDoc.exists() && sellerDoc.data().fullName) {
                sellerName = sellerDoc.data().fullName;
              }
            } catch (err) {
              console.log('Error fetching seller:', err);
            }
          }

          productList.push({
            id: docSnap.id,
            ...prodData,
            sellerName,
          });
        }

        setProducts(productList);
        setFilteredProducts(productList);
      } catch (error) {
        console.log('Error fetching all products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllProducts();
  }, []);

  // 🔍 กรองสินค้าตามคำค้นหาและหมวดหมู่
  useEffect(() => {
    let result = products;

    if (selectedCategory !== 'all') {
      result = result.filter((item) => item.category === selectedCategory);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(query) ||
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
        <Text style={styles.headerTitle}>สินค้าทั้งหมด📦</Text>
      </View>

      {/* 🔍 ช่องค้นหา */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาสินค้า..."
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
          <Text style={styles.emptyText}>ไม่พบสินค้าที่ค้นหา</Text>
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
              onPress={() => router.push(`/product/${item.id}`)}
            >
              <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />

              <View style={styles.productDetails}>
                <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.sellerName} numberOfLines={1}>{item.sellerName}</Text>
                <Text style={styles.productPrice}>฿ {item.price}</Text>
              </View>

              <TouchableOpacity
                style={styles.cartBtn}
                activeOpacity={0.8}
                onPress={() => router.push(`/product/${item.id}`)}
              >
                <Ionicons name="cart-outline" size={22} color="#1a5d3a" />
              </TouchableOpacity>
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
});