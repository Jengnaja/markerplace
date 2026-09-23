import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';
import { registerForPushNotificationsAsync } from '../../../services/notification';

export default function TabLayout() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'buyer' | 'seller'>('buyer');
  const [cartCount, setCartCount] = useState<number>(0);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // 🟢 1. ลงทะเบียนขอสิทธิ์ Push Notification และรับ Token
    registerForPushNotificationsAsync();

    // 🟢 2. ดักจับเมื่อผู้ใช้กดป๊อปอัพแจ้งเตือนบนหน้าจอมือถือ -> นำทางไปหน้าห้องแชททันที
    // 🟢 ดักจับเมื่อผู้ใช้กดป๊อปอัพแจ้งเตือน
const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
  // ✅ แปลงและระบุ Type เป็น string ชัดเจน
  const chatId = response.notification.request.content.data?.chatId as string;
  
  if (chatId) {
    router.push({
      pathname: '/chat/room' as any,
      params: { chatId: String(chatId) },
    });
  }
});

    // 3. ดึงข้อมูล User Role
    const fetchUserRole = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && userDoc.data().role) {
          setUserRole(userDoc.data().role);
        }
      } catch (error) {
        console.log('Error fetching user role:', error);
      }
    };
    fetchUserRole();

    // 4. ดึงจำนวนสินค้าในตะกร้าแบบ Real-time
    const cartQuery = query(
      collection(db, 'carts'),
      where('userId', '==', currentUser.uid)
    );
    const unsubCart = onSnapshot(cartQuery, (snapshot) => {
      const totalQuantity = snapshot.docs.reduce((sum, docSnap) => {
        const data = docSnap.data();
        return sum + (data.quantity || 1);
      }, 0);
      setCartCount(totalQuantity);
    });

    // 5. ดึงจำนวนแชทที่ยังไม่ได้อ่านแบบ Real-time
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );
    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      let unread = 0;
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.lastSenderId && data.lastSenderId !== currentUser.uid && data.isRead === false) {
          unread += 1;
        } else if (data.unreadCount && data.unreadCount > 0) {
          unread += data.unreadCount;
        }
      });
      setUnreadChatCount(unread);
    });

    return () => {
      unsubCart();
      unsubChats();
      responseListener.remove(); // เคลียร์ Listener เมื่อออกจากหน้า
    };
  }, []);

  return (
    <Tabs
      initialRouteName="home"
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

      {/* 3. 💬 แชท (มีตัวเลขแจ้งเตือนป้ายสีแดงเมื่อมีแชทใหม่) */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'แชท',
          tabBarBadge: unreadChatCount > 0 ? unreadChatCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 'bold',
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={23}
              color={color}
            />
          ),
        }}
      />

      {/* 4. 🛒 ตะกร้าสินค้า / คำสั่งซื้อ */}
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

      {/* 5. 👤 โปรไฟล์ */}
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