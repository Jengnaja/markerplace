import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { useRouter } from 'expo-router';

export default function SetupProfileScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [slogan, setSlogan] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  // Map State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [region] = useState({
    latitude: 13.8478,
    longitude: 100.493,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  const [markerCoords, setMarkerCoords] = useState({
    latitude: 13.8478,
    longitude: 100.493,
  });
  const [tempAddress, setTempAddress] = useState('กำลังค้นหาตำแหน่งที่ตั้ง...');

  const [loading, setLoading] = useState(false);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // 🟢 1. ตรวจสอบตอนโหลดหน้า: ถ้าเคยบันทึกโปรไฟล์เรียบร้อยแล้ว ให้พาไปหน้า Home ทันที
  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        setDisplayName(user.displayName || '');
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();

            // 🛑 ถ้าโปรไฟล์ตั้งค่าสมบูรณ์แล้ว ให้ข้ามไปหน้า Home ทันที (ป้องกันการเด้งกลับมาหน้านี้ตอนรีเฟรช)
            if (data.isProfileComplete) {
              router.replace('/(tabs)/home' as any);
              return;
            }

            if (data.address) setAddress(data.address);
            if (data.district) setDistrict(data.district);
            if (data.slogan) setSlogan(data.slogan);
            if (data.profileImage) setAvatar(data.profileImage);
          }
        } catch (e) {
          console.log('Error fetching user doc:', e);
        }
      }
    };
    fetchProfile();
  }, []);

  const handlePickAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('แจ้งเตือน', 'กรุณานุญาตให้เข้าถึงคลังภาพเพื่อเปลี่ยนรูปโปรไฟล์');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      setAvatar(result.assets[0].uri);
    }
  };

  // 🟢 แปลงพิกัดเป็นที่อยู่ภาษาไทย
  const getAddressFromCoords = async (lat: number, lng: number) => {
    lastFetchedCoordsRef.current = { latitude: lat, longitude: lng };
    setGeocodingLoading(true);

    try {
      const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (reverse.length > 0) {
        const item = reverse[0];
        
        let houseNo = item.streetNumber?.trim() || '';
        let placeName = item.name?.trim() || '';
        let streetName = item.street?.trim() || '';

        if (!houseNo) {
          const match = placeName.match(/^(\d+[\/\d]*)/);
          if (match) houseNo = match[1];
        }

        if (houseNo) {
          const escapedHouseNo = houseNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const houseRegex = new RegExp(`^${escapedHouseNo}\\s*`, 'i');
          placeName = placeName.replace(houseRegex, '').trim();
          streetName = streetName.replace(houseRegex, '').trim();
        }

        if (placeName === streetName) {
          streetName = '';
        }

        const cleanPrefix = (str?: string | null) => {
          if (!str) return '';
          return str.replace(/^(ต\.|ตำบล|อ\.|อำเภอ|จ\.|จังหวัด)\s*/g, '').trim();
        };

        const subdistrict = cleanPrefix(item.subregion);
        let amphoe = cleanPrefix(item.district);
        const province = cleanPrefix(item.city);

        if (subdistrict === amphoe) amphoe = '';

        const parts: string[] = [];
        if (houseNo) parts.push(`เลขที่ ${houseNo}`);
        if (placeName) parts.push(placeName);
        if (streetName && !placeName.includes(streetName)) parts.push(streetName);

        if (subdistrict) parts.push(`ต.${subdistrict}`);
        if (amphoe) parts.push(`อ.${amphoe}`);
        if (province) parts.push(`จ.${province}`);
        if (item.postalCode) parts.push(item.postalCode.trim());

        const fullAddress = parts.join(' ').replace(/\s+/g, ' ').trim();
        setTempAddress(fullAddress || 'ไม่พบชื่อสถานที่ในบริเวณนี้');

        if (subdistrict && !district) {
          setDistrict(`ต.${subdistrict}`);
        }
      }
    } catch (error) {
      console.log('Geocoding error:', error);
      setTempAddress('ไม่สามารถดึงที่อยู่ได้ กรุณากรอกรายละเอียดเพิ่มเติมด้วยตนเอง');
    } finally {
      setGeocodingLoading(false);
    }
  };

  // 📍 ดึงพิกัด GPS ปัจจุบันเมื่อกดปุ่ม GPS
  const getCurrentGpsLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('แจ้งเตือน', 'กรุณาเปิดสิทธิ์เข้าถึง GPS เพื่อดึงตำแหน่งปัจจุบัน');
        setGpsLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const currentLat = loc.coords.latitude;
      const currentLng = loc.coords.longitude;

      const targetRegion = {
        latitude: currentLat,
        longitude: currentLng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };

      mapRef.current?.animateToRegion(targetRegion, 800);
      setMarkerCoords({ latitude: currentLat, longitude: currentLng });

      await getAddressFromCoords(currentLat, currentLng);
    } catch (e) {
      console.log('Location error:', e);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถดึงตำแหน่ง GPS ได้');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleOpenMap = async () => {
    setIsMapModalOpen(true);
    setTimeout(() => {
      getCurrentGpsLocation();
    }, 400);
  };

  const handleSearchPlace = async () => {
    if (!searchQuery.trim()) return;
    try {
      const geocoded = await Location.geocodeAsync(searchQuery);
      if (geocoded.length > 0) {
        const { latitude, longitude } = geocoded[0];
        const targetRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        mapRef.current?.animateToRegion(targetRegion, 800);
        setMarkerCoords({ latitude, longitude });
        await getAddressFromCoords(latitude, longitude);
      } else {
        Alert.alert('ไม่พบสถานที่', 'ไม่พบสถานที่ที่คุณค้นหา กรุณาตรวจสอบคำค้นหาอีกครั้ง');
      }
    } catch (error) {
      console.log('Search error:', error);
    }
  };

  const handleConfirmLocation = () => {
    setAddress(tempAddress);
    setIsMapModalOpen(false);
  };

  // 🟢 2. บันทึกโปรไฟล์ด้วย setDoc + merge: true เพื่อความชัวร์ 100%
  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!displayName.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อที่จะแสดงในแอป');
      return;
    }

    setLoading(true);

    try {
      let finalAvatarUrl = avatar;

      if (avatar && avatar.startsWith('file://')) {
        const manipResult = await ImageManipulator.manipulateAsync(
          avatar,
          [{ resize: { width: 300, height: 300 } }],
          { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        finalAvatarUrl = `data:image/jpeg;base64,${manipResult.base64}`;
      }

      // ใช้ setDoc แบบ merge: true การันตีว่าเอกสารจะถูกบันทึกสำเร็จแน่นอน
      await setDoc(doc(db, 'users', user.uid), {
        fullName: displayName.trim(),
        district: district.trim(),
        address: address.trim(),
        slogan: slogan.trim(),
        profileImage: finalAvatarUrl,
        avatarUrl: finalAvatarUrl,
        location: markerCoords,
        isProfileComplete: true, // 👈 สถานะยืนยันว่าบันทึกโปรไฟล์เรียบร้อยแล้ว
      }, { merge: true });

      Alert.alert('สำเร็จ', 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว');
      router.replace('/(tabs)/home' as any);
    } catch (error) {
      console.log('Save profile error:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header Nav */}
      <View style={styles.headerNav}>
        <TouchableOpacity style={styles.backBtnHeader} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#0f172a" />
          <Text style={styles.backBtnText}>index</Text>
        </TouchableOpacity>
        <Text style={styles.headerNavTitle}>setup-profile</Text>
        <TouchableOpacity style={styles.settingsIcon}>
          <Ionicons name="settings" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={{ gap: 4, marginTop: 10 }}>
          <Text style={styles.mainTitle}>ตั้งค่าโปรไฟล์ของคุณ</Text>
          <Text style={styles.subTitle}>
            เพิ่มรูปภาพและปักหมุดที่อยู่ เพื่อให้ร้านค้าจัดส่งสินค้าได้อย่างถูกต้อง
          </Text>
        </View>

        {/* รูปโปรไฟล์ */}
        <TouchableOpacity activeOpacity={0.8} onPress={handlePickAvatar} style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={50} color="#94a3b8" />
            )}
            <View style={styles.cameraIconBadge}>
              <Ionicons name="camera" size={14} color="#ffffff" />
            </View>
          </View>
          <Text style={styles.avatarTipText}>แตะเพื่อเลือกรูปโปรไฟล์</Text>
        </TouchableOpacity>

        {/* ฟอร์มกรอกข้อมูล */}
        <View style={{ gap: 14 }}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ชื่อที่จะแสดงในแอป</Text>
            <View style={styles.inputBox}>
              <Ionicons name="person-outline" size={20} color="#94a3b8" />
              <TextInput
                style={styles.inputText}
                placeholder="ระบุชื่อ"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>อำเภอที่อยู่อาศัย (ในจังหวัดนนทบุรี)</Text>
            <View style={styles.inputBox}>
              <Ionicons name="business-outline" size={20} color="#94a3b8" />
              <TextInput
                style={styles.inputText}
                placeholder="ต.บางกระสอ"
                value={district}
                onChangeText={setDistrict}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.label}>ที่อยู่จัดส่งสินค้า</Text>
              <TouchableOpacity style={styles.pinBtnChip} onPress={handleOpenMap}>
                <Ionicons name="map-outline" size={16} color="#1a5d3a" />
                <Text style={styles.pinBtnText}>ปักหมุดที่อยู่</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputBox, { height: 85, alignItems: 'flex-start', paddingTop: 10 }]}>
              <Ionicons name="location-outline" size={20} color="#94a3b8" />
              <TextInput
                style={[styles.inputText, { textAlignVertical: 'top' }]}
                placeholder="บ้านเลขที่, ถนน, ซอย, รายละเอียดเพิ่มเติม..."
                value={address}
                onChangeText={setAddress}
                multiline
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>สโลแกน / คำแนะนำตัวสั้นๆ</Text>
            <View style={styles.inputBox}>
              <Ionicons name="information-circle-outline" size={20} color="#94a3b8" />
              <TextInput
                style={styles.inputText}
                placeholder="คำแนะนำตัวสั้นๆ"
                value={slogan}
                onChangeText={setSlogan}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveMainBtn, loading && { backgroundColor: '#a3a3a3' }]}
            onPress={handleSaveProfile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveMainBtnText}>บันทึกข้อมูลโปรไฟล์ ✨</Text>
            )}
          </TouchableOpacity>

        </View>

      </ScrollView>

      {/* Modal ปักหมุดที่อยู่ */}
      <Modal visible={isMapModalOpen} animationType="slide" onRequestClose={() => setIsMapModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
          
          <View style={styles.mapModalHeader}>
            <TouchableOpacity onPress={() => setIsMapModalOpen(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={26} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.mapModalTitle}>ปักหมุดตำแหน่งจัดส่ง</Text>
            <View style={{ width: 30 }} />
          </View>

          <View style={styles.searchMapRow}>
            <View style={styles.searchMapInputBox}>
              <Ionicons name="search-outline" size={20} color="#94a3b8" />
              <TextInput
                style={styles.searchMapInput}
                placeholder="พิมพ์ค้นหาชื่อสถานที่, ซอย หรือถนน..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchPlace}
              />
            </View>
            <TouchableOpacity style={styles.searchMapBtn} onPress={handleSearchPlace}>
              <Text style={styles.searchMapBtnText}>ค้นหา</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, position: 'relative' }}>
            <MapView
              ref={mapRef}
              style={{ width: '100%', height: '100%' }}
              initialRegion={region}
              showsUserLocation={true}
              showsMyLocationButton={false}
              onRegionChangeComplete={(newRegion) => {
                setMarkerCoords({ latitude: newRegion.latitude, longitude: newRegion.longitude });
                
                if (lastFetchedCoordsRef.current) {
                  const latDiff = Math.abs(lastFetchedCoordsRef.current.latitude - newRegion.latitude);
                  const lngDiff = Math.abs(lastFetchedCoordsRef.current.longitude - newRegion.longitude);
                  
                  if (latDiff < 0.0001 && lngDiff < 0.0001) {
                    return;
                  }
                }

                if (geocodeTimerRef.current) {
                  clearTimeout(geocodeTimerRef.current);
                }

                geocodeTimerRef.current = setTimeout(() => {
                  getAddressFromCoords(newRegion.latitude, newRegion.longitude);
                }, 600);
              }}
            />

            {/* 📍 หมุดปักสีแดงเด่นชัดตรงกลางจอ */}
            <View style={styles.centerPinOverlay} pointerEvents="none">
              <View style={styles.pinWrapper}>
                <Ionicons name="location-sharp" size={48} color="#ef4444" />
                <View style={styles.pinShadow} />
              </View>
            </View>

            {/* ปุ่ม GPS ลอย */}
            <TouchableOpacity
              style={styles.currentGpsFloatingBtn}
              activeOpacity={0.8}
              onPress={getCurrentGpsLocation}
            >
              {gpsLoading ? (
                <ActivityIndicator size="small" color="#1a5d3a" />
              ) : (
                <Ionicons name="locate" size={24} color="#1a5d3a" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.bottomAddressCard}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Ionicons name="location-sharp" size={24} color="#ef4444" style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500' }}>ตำแหน่งที่คุณเลือก:</Text>
                {geocodingLoading ? (
                  <ActivityIndicator color="#1a5d3a" size="small" style={{ alignSelf: 'flex-start' }} />
                ) : (
                  <Text style={styles.selectedAddressText}>{tempAddress}</Text>
                )}
              </View>
            </View>

            <TouchableOpacity style={styles.confirmMapBtn} onPress={handleConfirmLocation}>
              <Text style={styles.confirmMapBtnText}>ยืนยันตำแหน่งนี้</Text>
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  headerNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  backBtnHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  backBtnText: { fontSize: 14, color: '#0f172a', fontWeight: 'bold' },
  headerNavTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  settingsIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a5d3a' },
  subTitle: { fontSize: 13, color: '#64748b', lineHeight: 18 },

  avatarSection: { alignItems: 'center', marginVertical: 8, gap: 6 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#f1f5f9', borderWidth: 2, borderColor: '#1a5d3a', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
  avatarImg: { width: '100%', height: '100%' },
  cameraIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1a5d3a', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff' },
  avatarTipText: { fontSize: 13, color: '#1a5d3a', fontWeight: 'bold' },

  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 14, height: 48, backgroundColor: '#f8fafc' },
  inputText: { flex: 1, fontSize: 14, color: '#0f172a' },

  pinBtnChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pinBtnText: { fontSize: 12, fontWeight: 'bold', color: '#1a5d3a' },

  saveMainBtn: { backgroundColor: '#1a5d3a', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  saveMainBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  /* Map Modal */
  mapModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  mapModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  searchMapRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  searchMapInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchMapInput: { flex: 1, fontSize: 13, color: '#0f172a' },
  searchMapBtn: { backgroundColor: '#1a5d3a', paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  searchMapBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

  /* 📍 หมุดตรงกลางพร้อมเงา */
  centerPinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  pinShadow: {
    width: 10,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 5,
    marginTop: -6,
  },

  currentGpsFloatingBtn: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    backgroundColor: '#ffffff',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },

  bottomAddressCard: { backgroundColor: '#ffffff', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14, elevation: 8 },
  selectedAddressText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', lineHeight: 20 },
  confirmMapBtn: { backgroundColor: '#1a5d3a', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  confirmMapBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
});