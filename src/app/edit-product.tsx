import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Modal,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { useRouter, useLocalSearchParams } from 'expo-router';

const CATEGORIES = [
  { id: 'processed', name: 'สินค้าแปรรูป', icon: 'cube-outline' },
  { id: 'food', name: 'อาหาร', icon: 'restaurant-outline' },
  { id: 'handicraft', name: 'หัตถกรรม', icon: 'basket-outline' },
  { id: 'herb', name: 'สมุนไพร', icon: 'leaf-outline' },
];

export default function EditProductScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // รับ Product ID ที่ส่งมาจากหน้าจัดการสินค้า

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('processed');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type: 'error' | 'warning';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'error',
    title: '',
    message: '',
  });

  const showAlert = (type: 'error' | 'warning', title: string, message: string) => {
    setAlertConfig({ visible: true, type, title, message });
  };

  const hideAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  // 📥 ดึงข้อมูลสินค้าเดิมจาก Firestore มาแสดงในฟอร์ม
  useEffect(() => {
    const fetchProductData = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTitle(data.title || '');
          setPrice(data.price ? data.price.toString() : '');
          setDescription(data.description || '');
          setSelectedCategory(data.category || 'processed');
          setProductImage(data.image || null);
        } else {
          showAlert('error', 'ไม่พบข้อมูล', 'ไม่พบสินค้าที่คุณต้องการแก้ไข');
        }
      } catch (error) {
        console.log('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
  }, [id]);

  // 📸 เลือกรูปใหม่และบีบอัดขนาด
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      showAlert('warning', 'สิทธิ์เข้าถึง', 'กรุณาอนุญาตการเข้าถึงคลังภาพเพื่อเลือกรูปสินค้า');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2, // บีบอัดภาพ
    });

    if (!result.canceled && result.assets[0].uri) {
      setProductImage(result.assets[0].uri);
    }
  };

  // 💾 บันทึกการแก้ไขลง Firestore
  const handleUpdateProduct = async () => {
    if (!title.trim() || !price.trim() || !productImage) {
      showAlert('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อสินค้า ราคา และเลือกรูปภาพสินค้า');
      return;
    }

    setSaving(true);

    try {
      let finalProductImage = productImage;

      // ถ้ามีการเปลี่ยนรูปใหม่ (เป็น file://) ให้แปลงเป็น Base64 ถาวร
      if (productImage.startsWith('file://')) {
        finalProductImage = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = function () {
            const reader = new FileReader();
            reader.onloadend = function () {
              resolve(reader.result as string);
            };
            reader.readAsDataURL(xhr.response);
          };
          xhr.onerror = function (e) {
            reject(e);
          };
          xhr.responseType = 'blob';
          xhr.open('GET', productImage, true);
          xhr.send(null);
        });
      }

      const docRef = doc(db, 'products', id as string);
      await updateDoc(docRef, {
        title: title.trim(),
        price: parseFloat(price) || 0,
        category: selectedCategory,
        description: description.trim(),
        image: finalProductImage,
        updatedAt: new Date().toISOString(),
      });

      showAlert('warning', 'สำเร็จ', 'แก้ไขข้อมูลสินค้าเรียบร้อยแล้ว');
      setTimeout(() => router.back(), 1500);
    } catch (error: any) {
      console.log('Error updating product:', error);
      showAlert('error', 'บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
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
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1a5d3a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แก้ไขสินค้า ✏️</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Modal แจ้งเตือน */}
      <Modal transparent visible={alertConfig.visible} animationType="fade" onRequestClose={hideAlert}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            <TouchableOpacity style={styles.alertButton} onPress={hideAlert}>
              <Text style={styles.alertButtonText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* รูปภาพสินค้า */}
          <View style={styles.imageSection}>
            <TouchableOpacity activeOpacity={0.8} style={styles.imagePickerBox} onPress={pickImage}>
              {productImage ? (
                <Image source={{ uri: productImage }} style={styles.previewImage} />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Ionicons name="camera-outline" size={42} color="#1a5d3a" />
                  <Text style={styles.placeholderText}>เปลี่ยนรูปภาพสินค้า</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            {/* ชื่อสินค้า */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ชื่อสินค้า</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="ระบุชื่อสินค้า"
              />
            </View>

            {/* ราคา */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ราคา (บาท)</Text>
              <TextInput
                style={styles.textInput}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="0.00"
              />
            </View>

            {/* ประเภทสินค้า */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ประเภทสินค้า</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                      onPress={() => setSelectedCategory(cat.id)}
                    >
                      <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* รายละเอียด */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>รายละเอียดสินค้า</Text>
              <TextInput
                style={[styles.textInput, { height: 90, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* ปุ่มบันทึกการแก้ไข */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.submitButton, saving && styles.disabledButton]}
              onPress={handleUpdateProduct}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>บันทึกการแก้ไข ✨</Text>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f2f7f4', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a5d3a' },
  imageSection: { alignItems: 'center', marginVertical: 16 },
  imagePickerBox: { width: '100%', height: 180, borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', backgroundColor: '#f8fafc', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderContainer: { alignItems: 'center', gap: 6 },
  placeholderText: { fontSize: 14, fontWeight: 'bold', color: '#1a5d3a' },
  formContainer: { gap: 16 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333333' },
  textInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, height: 50, backgroundColor: '#f8fafc', fontSize: 15, color: '#1e293b' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#1a5d3a', backgroundColor: '#ffffff' },
  categoryChipActive: { backgroundColor: '#1a5d3a' },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#1a5d3a' },
  categoryChipTextActive: { color: '#ffffff' },
  submitButton: { backgroundColor: '#1a5d3a', height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  disabledButton: { backgroundColor: '#8cb89f' },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  alertBox: { width: '85%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 8 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 22 },
  alertButton: { width: '100%', height: 48, borderRadius: 24, backgroundColor: '#1a5d3a', justifyContent: 'center', alignItems: 'center' },
  alertButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});