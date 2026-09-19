import React, { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { Tabs, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';

export default function TabLayout() {
  const [userRole, setUserRole] = useState<'buyer' | 'seller'>('buyer');
  const [cartCount, setCartCount] = useState<number>(0);

  // 🟢 ดึง Role และนับจำนวนสินค้าทั้งหมดในตะกร้าแบบ Real-time เมื่อสลับหน้า
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            // ดึง Role ผู้ใช้
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists() && userDoc.data().role) {
              setUserRole(userDoc.data().role);
            }

            // คำนวณผลรวมจำนวนชิ้นสินค้าทั้งหมดในตะกร้า
            const cartQuery = query(collection(db, 'carts'), where('userId', '==', currentUser.uid));
            const cartSnap = await getDocs(cartQuery);
            
            const totalQuantity = cartSnap.docs.reduce((sum, docSnap) => {
              const data = docSnap.data();
              return sum + (data.quantity || 1);
            }, 0);

            setCartCount(totalQuantity);
          } catch (error) {
            console.log('Error fetching layout data:', error);
          }
        }
      };

      fetchData();
    }, [])
  );

  return (
    <Tabs
      initialRouteName="home" // 👈 กำหนดหน้า Home เป็นหน้าเริ่มต้นเสมอ
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a5d3a',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {/* 1. 🏠 หน้าหลัก */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'หน้าหลัก',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={color} />
          ),
        }}
      />

      {/* 2. 📦 สินค้า */}
      <Tabs.Screen
        name="products"
        options={{
          title: 'สินค้า',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={23} color={color} />
          ),
        }}
      />

      {/* 3. 🛒 ตะกร้าสินค้า / คำสั่งซื้อ */}
      <Tabs.Screen
        name="cart"
        options={{
          title: userRole === 'seller' ? 'คำสั่งซื้อ' : 'ตะกร้า',
          tabBarBadge: userRole === 'buyer' && cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 'bold',
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                userRole === 'seller'
                  ? focused
                    ? 'receipt'
                    : 'receipt-outline'
                  : focused
                  ? 'cart'
                  : 'cart-outline'
              }
              size={23}
              color={color}
            />
          ),
        }}
      />

      {/* 4. 👤 โปรไฟล์ */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'โปรไฟล์',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}