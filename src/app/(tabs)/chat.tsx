import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';

// 🟢 คอมโพเนนต์การ์ดแชท ดึงรูปโปรไฟล์จากคอลเลกชัน users โดยตรง
function ChatItemCard({ item, currentUser, router, formatTime }: any) {
  const isSeller = currentUser?.uid === item.sellerId;
  const targetUserId = isSeller ? item.buyerId : item.sellerId;

  const [userInfo, setUserInfo] = useState<{ displayName: string; avatarUrl: string }>({
    displayName: isSeller ? (item.buyerName || 'ลูกค้า') : (item.sellerName || 'ร้านค้าชุมชน'),
    avatarUrl: isSeller ? (item.buyerImage || '') : (item.sellerImage || ''),
  });

  useEffect(() => {
    let isMounted = true;
    const fetchUserProfile = async () => {
      if (!targetUserId) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists() && isMounted) {
          const uData = userDoc.data();
          const img = uData.profileImage || uData.avatar || uData.photoURL || uData.image || '';
          const name = uData.fullName || uData.name || uData.displayName || userInfo.displayName;
          setUserInfo({
            displayName: name,
            avatarUrl: img,
          });
        }
      } catch (error) {
        console.log('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
    return () => {
      isMounted = false;
    };
  }, [targetUserId]);

  const roleBadge = isSeller ? 'ลูกค้า' : 'ร้านค้า';

  return (
    <TouchableOpacity
      style={styles.chatCard}
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: '/chat/room' as any,
          params: {
            chatId: item.chatId,
            sellerName: userInfo.displayName,
            targetImage: userInfo.avatarUrl,
            targetUserId: targetUserId,
          },
        })
      }
    >
      {/* รูปโปรไฟล์ */}
      <View style={styles.avatarContainer}>
        {userInfo.avatarUrl ? (
          <Image source={{ uri: userInfo.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarCircle}>
            <Ionicons name={isSeller ? 'person' : 'storefront'} size={22} color="#1a5d3a" />
          </View>
        )}
        <View style={styles.onlineDot} />
      </View>

      {/* ข้อมูลการสนทนา */}
      <View style={styles.chatContent}>
        <View style={styles.chatHeaderRow}>
          <Text style={styles.displayName} numberOfLines={1}>
            {userInfo.displayName}
          </Text>
          <Text style={styles.timeText}>{formatTime(item.updatedAt)}</Text>
        </View>

        <View style={styles.chatSubRow}>
          <Text style={styles.lastMessageText} numberOfLines={1}>
            {item.lastMessage || 'เริ่มการสนทนา'}
          </Text>
          <View style={[styles.roleBadge, isSeller ? styles.buyerBadge : styles.sellerBadge]}>
            <Text style={[styles.roleBadgeText, isSeller ? styles.buyerBadgeText : styles.sellerBadgeText]}>
              {roleBadge}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatListScreen() {
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  const formatTime = (time: any) => {
    if (!time) return '';
    try {
      const date = time?.toDate ? time.toDate() : new Date(time);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      (snapshot) => {
        const chatData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        chatData.sort((a: any, b: any) => {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return timeB - timeA;
        });

        setChats(chatData);
        setLoading(false);
      },
      (error) => {
        console.log('Error fetching chats:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const filteredChats = chats.filter((chat) => {
    const isSeller = currentUser?.uid === chat.sellerId;
    const targetName = isSeller ? chat.buyerName : chat.sellerName;
    return targetName?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>ข้อความและการแจ้งเตือน</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาชื่อร้านค้า หรือ ลูกค้า..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#1a5d3a" />
        </View>
      ) : filteredChats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>ยังไม่มีรายการแชท</Text>
          <Text style={styles.emptySubText}>
            {currentUser ? 'ข้อความสนทนากับร้านค้าและลูกค้าจะแสดงที่นี่' : 'กรุณาเข้าสู่ระบบเพื่อใช้งานระบบแชท'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatItemCard
              item={item}
              currentUser={currentUser}
              router={router}
              formatTime={formatTime}
            />
          )}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#ffffff' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listPadding: { paddingHorizontal: 16, paddingBottom: 20 },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 1,
  },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  chatContent: { flex: 1 },
  chatHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  displayName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', flex: 1, marginRight: 8 },
  timeText: { fontSize: 11, color: '#94a3b8' },
  chatSubRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessageText: { fontSize: 13, color: '#64748b', flex: 1, marginRight: 8 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roleBadgeText: { fontSize: 10, fontWeight: 'bold' },
  buyerBadge: { backgroundColor: '#eff6ff' },
  buyerBadgeText: { color: '#2563eb' },
  sellerBadge: { backgroundColor: '#f0fdf4' },
  sellerBadgeText: { color: '#16a34a' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#475569', marginTop: 10 },
  emptySubText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
});