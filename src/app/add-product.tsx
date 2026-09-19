import React, { useState } from 'react';
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
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { useRouter } from 'expo-router';

const CATEGORIES = [
  { id: 'processed', name: 'สินค้าแปรรูป', icon: 'cube-outline' },
  { id: 'food', name: 'อาหาร', icon: 'restaurant-outline' },
  { id: 'handicraft', name: 'หัตถกรรม', icon: 'basket-outline' },
  { id: 'herb', name: 'สมุนไพร', icon: 'leaf-outline' },
];

export default function AddProductScreen() {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('processed');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const currentUser = auth.currentUser;

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

  // 📸 เลือกรูปและบีบอัดขนาดเพื่อป้องกันข้อมูลใหญ่เกินไป
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
      quality: 0.2, // 👈 บีบอัดภาพให้เล็กลง
    });

    if (!result.canceled && result.assets[0].uri) {
      setProductImage(result.assets[0].uri);
    }
  };

  // 🚀 บันทึกสินค้าลง Firestore พร้อมแปลงรูปเป็น Base64
  const handleSaveProduct = async () => {
    if (!title.trim() || !price.trim() || !productImage) {
      showAlert('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อสินค้า ราคา และเลือกรูปภาพสินค้า');
      return;
    }

    if (!currentUser) {
      showAlert('error', 'ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
      return;
    }

    setLoading(true);

    try {
      console.log('📦 กำลังแปลงรูปภาพและบันทึกสินค้าลง Firestore...');
      
      let finalProductImage = productImage;

      // 🟢 ถ้าเป็นรูปใหม่จากเครื่อง (file://) ให้แปลงเป็น Base64 ก่อนบันทึก
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

      const docRef = await addDoc(collection(db, 'products'), {
        sellerId: currentUser.uid,
        title: title.trim(),
        price: parseFloat(price) || 0,
        category: selectedCategory,
        description: description.trim(),
        image: finalProductImage, // 👈 บันทึกเป็น Base64 String ถาวร
        createdAt: new Date().toISOString(),
      });

      console.log('✅ บันทึกสำเร็จ! Document ID:', docRef.id);
      router.back();
    } catch (error: any) {
      console.log('❌ Error adding product:', error);
      showAlert(
        'error',
        'บันทึกไม่สำเร็จ',
        error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1a5d3a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>เพิ่มสินค้าใหม่ 📦</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Modal แจ้งเตือน */}
      <Modal transparent visible={alertConfig.visible} animationType="fade" onRequestClose={hideAlert}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <View
              style={[
                styles.alertIconBg,
                alertConfig.type === 'error' && { backgroundColor: '#ffebee' },
                alertConfig.type === 'warning' && { backgroundColor: '#fff3e0' },
              ]}
            >
              <Ionicons
                name={alertConfig.type === 'error' ? 'close-circle-outline' : 'alert-circle-outline'}
                size={52}
                color={alertConfig.type === 'error' ? '#d32f2f' : '#ed6c02'}
              />
            </View>
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            <TouchableOpacity
              style={[
                styles.alertButton,
                alertConfig.type === 'error' && { backgroundColor: '#d32f2f' },
                alertConfig.type === 'warning' && { backgroundColor: '#ed6c02' },
              ]}
              onPress={hideAlert}
            >
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
                  <Text style={styles.placeholderText}>เพิ่มรูปภาพสินค้า</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            {/* ชื่อสินค้า */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ชื่อสินค้า</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="pricetag-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="เช่น ข้าวกล้องอินทรีย์, กระเป๋าสาน"
                  placeholderTextColor="#aaa"
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
            </View>

            {/* ราคา */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ราคา (บาท)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="cash-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
            </View>

            {/* หมวดหมู่สินค้า */}
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
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={18}
                        color={isSelected ? '#ffffff' : '#1a5d3a'}
                      />
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
              <View style={[styles.inputWrapper, { height: 90, alignItems: 'flex-start', paddingTop: 10 }]}>
                <Ionicons name="document-text-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { textAlignVertical: 'top' }]}
                  placeholder="อธิบายรายละเอียดสินค้า..."
                  placeholderTextColor="#aaa"
                  multiline
                  numberOfLines={4}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>
            </View>

            {/* ปุ่มบันทึก */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSaveProduct}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>บันทึกและลงขายสินค้า 🛒</Text>
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
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, height: 50, backgroundColor: '#f8fafc' },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 15, color: '#1e293b' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#1a5d3a', backgroundColor: '#ffffff' },
  categoryChipActive: { backgroundColor: '#1a5d3a' },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#1a5d3a' },
  categoryChipTextActive: { color: '#ffffff' },
  submitButton: { backgroundColor: '#1a5d3a', height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginTop: 12, elevation: 3 },
  disabledButton: { backgroundColor: '#8cb89f' },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  alertBox: { width: '85%', backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 8 },
  alertIconBg: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 22, lineHeight: 20 },
  alertButton: { width: '100%', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  alertButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});