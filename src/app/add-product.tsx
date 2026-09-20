import React, { useState, useEffect } from 'react';
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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../services/firebase';

const CATEGORIES = [
  { id: 'food', name: 'อาหาร' },
  { id: 'handicraft', name: 'หัตถกรรม' },
  { id: 'herb', name: 'สมุนไพร' },
  { id: 'processed', name: 'แปรรูป' },
];

export default function AddProductScreen() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // ฟอร์มสินค้า
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('food');
  const [imageUri, setImageUri] = useState<string | null>(null);

  // 🟢 ตรวจสอบสถานะการเข้าสู่ระบบและสิทธิ์ร้านค้า
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        Alert.alert('กรุณาล็อกอิน', 'คุณต้องเข้าสู่ระบบก่อนเพิ่มสินค้า');
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/login' as any);
        }
        setCheckingAuth(false);
        return;
      }

      setCurrentUser(user);

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as any;
          const roleStr = (
            userData?.role ||
            userData?.userType ||
            userData?.type ||
            ''
          ).toString().toLowerCase();

          const isSeller =
            roleStr === 'seller' ||
            roleStr === 'ร้านค้า' ||
            userData?.isSeller === true;

          if (!isSeller) {
            Alert.alert('ไม่มีสิทธิ์เข้าถึง', 'เฉพาะผู้ใช้บทบาทร้านค้าเท่านั้นที่สามารถเพิ่มสินค้าได้');
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/home' as any);
            }
          }
        }
      } catch (error) {
        console.log('Error verifying seller role:', error);
      } finally {
        setCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 🟢 ป๊อปอัพให้เลือกวิธีเพิ่มรูป (ถ่ายภาพ / เลือกจากอัลบั้ม)
  const handleSelectImageSource = () => {
    Alert.alert(
      'เลือกรูปภาพสินค้า',
      'กรุณาเลือกช่องทางที่ต้องการนำรูปภาพเข้า',
      [
        {
          text: '📷 ถ่ายภาพด้วยกล้อง',
          onPress: handleTakePhoto,
        },
        {
          text: '🖼️ เลือกจากคลังภาพ',
          onPress: handlePickFromLibrary,
        },
        {
          text: 'ยกเลิก',
          style: 'cancel',
        },
      ]
    );
  };

  // 📸 1. ถ่ายภาพด้วยกล้อง
  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('แจ้งเตือน', 'กรุณานุญาตให้เข้าถึงกล้องถ่ายรูปเพื่อถ่ายภาพสินค้า');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0].uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  // 🖼️ 2. เลือกรูปภาพจากคลังภาพ
  const handlePickFromLibrary = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('แจ้งเตือน', 'กรุณานุญาตให้เข้าถึงคลังรูปภาพเพื่อเลือกรูปสินค้า');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0].uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  // 💾 บันทึกสินค้าลง Firestore
  const handleAddProduct = async () => {
    if (!title.trim()) {
      Alert.alert('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อสินค้า');
      return;
    }
    if (!price.trim() || isNaN(Number(price))) {
      Alert.alert('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกราคาสินค้าเป็นตัวเลข');
      return;
    }
    if (!imageUri) {
      Alert.alert('ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกหรือถ่ายรูปภาพสินค้า');
      return;
    }

    setSubmitting(true);
    try {
      let finalImageBase64 = imageUri;

      // แปลงรูปเป็น Base64 ขนาดเล็กเพื่อจัดเก็บใน Firestore
      if (imageUri.startsWith('file://')) {
        const manipResult = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 500 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        finalImageBase64 = `data:image/jpeg;base64,${manipResult.base64}`;
      }

      await addDoc(collection(db, 'products'), {
        title: title.trim(),
        name: title.trim(),
        price: Number(price),
        description: description.trim(),
        category,
        image: finalImageBase64,
        sellerId: currentUser.uid,
        userId: currentUser.uid,
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      Alert.alert('สำเร็จ! 🎉', 'เพิ่มสินค้าใหม่เรียบร้อยแล้ว', [
        {
          text: 'ตกลง',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/products' as any);
            }
          },
        },
      ]);
    } catch (error) {
      console.log('Error adding product:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกสินค้าได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  // 🔙 ปุ่มย้อนกลับ
  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/products' as any);
    }
  };

  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a5d3a" />
        <Text style={styles.loadingText}>กำลังตรวจสอบสิทธิ์...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf9f5" />

      {/* Header Nav */}
      <View style={styles.headerNav}>
        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={26} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>เพิ่มสินค้าใหม่ 📦</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* เลือกรูปภาพสินค้า */}
        <Text style={styles.inputLabel}>รูปภาพสินค้า *</Text>
        <TouchableOpacity style={styles.imagePickerBox} activeOpacity={0.8} onPress={handleSelectImageSource}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera-outline" size={36} color="#1a5d3a" />
              <Text style={styles.imagePlaceholderText}>กดเพื่อถ่ายภาพหรือเลือกรูปสินค้า</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ชื่อสินค้า */}
        <Text style={styles.inputLabel}>ชื่อสินค้า *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="เช่น น้ำพริกเผาโบราณ, ผ้าขาวม้าทอมือ"
          placeholderTextColor="#94a3b8"
          value={title}
          onChangeText={setTitle}
        />

        {/* ราคาสินค้า */}
        <Text style={styles.inputLabel}>ราคา (บาท) *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="เช่น 150"
          placeholderTextColor="#94a3b8"
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
        />

        {/* หมวดหมู่สินค้า */}
        <Text style={styles.inputLabel}>หมวดหมู่สินค้า *</Text>
        <View style={styles.categoryContainer}>
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryOption, isSelected && styles.categoryOptionActive]}
                onPress={() => setCategory(cat.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryOptionText, isSelected && styles.categoryOptionTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* รายละเอียดสินค้า */}
        <Text style={styles.inputLabel}>รายละเอียดสินค้าเพิ่มเติม</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="อธิบายรายละเอียดสินค้า วัตถุดิบ หรือขนาด..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        {/* ปุ่มบันทึก */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleAddProduct}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
              <Text style={styles.submitBtnText}>บันทึกเพิ่มสินค้า</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#faf9f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 14, color: '#64748b' },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a5d3a' },
  scrollContent: { padding: 20, gap: 12 },
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginTop: 4 },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  imagePickerBox: {
    width: '100%',
    height: 180,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  imagePlaceholder: { alignItems: 'center', gap: 6 },
  imagePlaceholderText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  previewImage: { width: '100%', height: '100%' },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  categoryOptionActive: {
    backgroundColor: '#1a5d3a',
    borderColor: '#1a5d3a',
  },
  categoryOptionText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  categoryOptionTextActive: { color: '#ffffff' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a5d3a',
    height: 50,
    borderRadius: 25,
    marginTop: 16,
    gap: 8,
    elevation: 2,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});