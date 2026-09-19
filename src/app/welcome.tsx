import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 🖼️ ส่วนแสดงรูปภาพโปสเตอร์พร้อม Gradient Fade ขอบล่าง */}
      <View style={styles.imageContainer}>
        <Image
          source={require('../../assets/images/bgres.png')}
          style={styles.posterImage}
          resizeMode="cover"
        />
        
        {/* 🟢 เลเยอร์ไล่สีขาวเฟดตรงขอบล่างรูป */}
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.6)', '#ffffff']}
          style={styles.fadeOverlay}
        />
      </View>

      {/* 🟢 ส่วนปุ่มดำเนินการเข้าสู่ระบบ / สมัครสมาชิก */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.loginBtn}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.loginBtnText}>เข้าสู่ระบบ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.registerBtn}
          onPress={() => router.push('/register')}
        >
          <Text style={styles.registerBtnText}>สมัครสมาชิก</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  imageContainer: {
    flex: 1,
    width: width,
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  fadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  loginBtn: {
    backgroundColor: '#1a5d3a',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#1a5d3a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerBtn: {
    backgroundColor: '#ffffff',
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#1a5d3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerBtnText: {
    color: '#1a5d3a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});