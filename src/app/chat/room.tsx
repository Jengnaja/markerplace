import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';
import { sendPushNotification } from '../../../services/notification';

export default function ChatRoomScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const params = useLocalSearchParams<{
    chatId: string;
    sellerName?: string;
    targetImage?: string;
    targetUserId?: string;
    productTitle?: string;
    productPrice?: string;
    productImage?: string;
  }>();

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [targetUser, setTargetUser] = useState<{ name: string; avatar: string }>({
    name: params.sellerName || 'คู่สนทนา',
    avatar: params.targetImage || '',
  });

  const currentUser = auth.currentUser;

  // 🟢 ดึงข้อมูลโปรไฟล์คู่สนทนา + เคลียร์ป้ายอ่านแล้ว
  useEffect(() => {
    if (!params.chatId) return;

    updateDoc(doc(db, 'chats', params.chatId), {
      isRead: true,
    }).catch(() => {});

    const fetchTargetProfile = async () => {
      try {
        const chatSnap = await getDoc(doc(db, 'chats', params.chatId));
        let otherUid = params.targetUserId;

        if (chatSnap.exists()) {
          const cData = chatSnap.data();
          const isSellerRole = currentUser?.uid === cData.sellerId;
          otherUid = otherUid || (isSellerRole ? cData.buyerId : cData.sellerId);
        }

        if (otherUid) {
          const userSnap = await getDoc(doc(db, 'users', otherUid));
          if (userSnap.exists()) {
            const uData = userSnap.data();
            setTargetUser({
              name: uData.fullName || uData.name || params.sellerName || 'คู่สนทนา',
              avatar: uData.profileImage || uData.avatar || uData.photoURL || uData.image || params.targetImage || '',
            });
          }
        }
      } catch (err) {
        console.log('Error fetching room profile:', err);
      }
    };

    fetchTargetProfile();

    const messagesRef = collection(db, 'chats', params.chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setMessages(msgs);

      if (snapshot.docs.length > 0) {
        updateDoc(doc(db, 'chats', params.chatId), {
          isRead: true,
        }).catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [params.chatId]);

  // 🔔 ฟังก์ชันยิง Push Notification
  const triggerNotification = async (textToSend: string) => {
    try {
      const chatSnap = await getDoc(doc(db, 'chats', params.chatId));
      if (chatSnap.exists()) {
        const cData = chatSnap.data();
        const targetUid = currentUser?.uid === cData.sellerId ? cData.buyerId : cData.sellerId;

        if (targetUid) {
          const targetUserSnap = await getDoc(doc(db, 'users', targetUid));
          if (targetUserSnap.exists()) {
            const targetToken = targetUserSnap.data()?.pushToken;
            const senderName = currentUser?.displayName || 'มีข้อความใหม่';

            if (targetToken) {
              await sendPushNotification(
                targetToken,
                senderName,
                textToSend,
                params.chatId
              );
            }
          }
        }
      }
    } catch (error) {
      console.log('Error sending push notification:', error);
    }
  };

  // 💬 ฟังก์ชันส่งข้อความทั่วไป (เพิ่มกลับมาแล้ว)
  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUser || !params.chatId) return;

    const textToSend = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'chats', params.chatId, 'messages'), {
        senderId: currentUser.uid,
        text: textToSend,
        createdAt: new Date().toISOString(),
      });

      await updateDoc(doc(db, 'chats', params.chatId), {
        lastMessage: textToSend,
        lastSenderId: currentUser.uid,
        isRead: false,
        updatedAt: new Date().toISOString(),
      });

      await triggerNotification(textToSend);
    } catch (error) {
      console.log('Error sending message:', error);
    }
  };

  // 🛍️ ฟังก์ชันส่งการ์ดสินค้า
  const handleSendProductCard = async () => {
    if (!currentUser || !params.chatId || !params.productTitle) return;

    const textToSend = `สนใจสินค้า: ${params.productTitle}`;

    try {
      await addDoc(collection(db, 'chats', params.chatId, 'messages'), {
        senderId: currentUser.uid,
        text: textToSend,
        productImage: params.productImage || '',
        productPrice: params.productPrice || '',
        createdAt: new Date().toISOString(),
      });

      await updateDoc(doc(db, 'chats', params.chatId), {
        lastMessage: textToSend,
        lastSenderId: currentUser.uid,
        isRead: false,
        updatedAt: new Date().toISOString(),
      });

      await triggerNotification(textToSend);
    } catch (error) {
      console.log('Error sending product card:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>

        {targetUser.avatar ? (
          <Image source={{ uri: targetUser.avatar }} style={styles.headerAvatar} />
        ) : (
          <View style={styles.headerAvatarCircle}>
            <Ionicons name="person" size={18} color="#1a5d3a" />
          </View>
        )}

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerName} numberOfLines={1}>
            {targetUser.name}
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.greenDot} />
            <Text style={styles.statusText}>กำลังใช้งาน</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.moreBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* พรีวิวแถบสินค้าด้านบน */}
      {params.productTitle && (
        <View style={styles.productBanner}>
          {params.productImage && (
            <Image source={{ uri: params.productImage }} style={styles.productBannerImg} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.productBannerTitle} numberOfLines={1}>
              {params.productTitle}
            </Text>
            <Text style={styles.productBannerPrice}>฿ {params.productPrice}</Text>
          </View>
          <TouchableOpacity
            style={styles.sendProductTagBtn}
            onPress={() => handleSendProductCard()}
          >
            <Text style={styles.sendProductTagText}>ส่งข้อมูลสินค้า</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* รายการข้อความ */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatPadding}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMyMessage = item.senderId === currentUser?.uid;
            return (
              <View
                style={[
                  styles.messageRow,
                  isMyMessage ? styles.myMessageRow : styles.theirMessageRow,
                ]}
              >
                {!isMyMessage && (
                  targetUser.avatar ? (
                    <Image source={{ uri: targetUser.avatar }} style={styles.msgAvatar} />
                  ) : (
                    <View style={styles.msgAvatarCircle}>
                      <Ionicons name="person" size={14} color="#1a5d3a" />
                    </View>
                  )
                )}

                <View
                  style={[
                    styles.bubble,
                    isMyMessage ? styles.myBubble : styles.theirBubble,
                  ]}
                >
                  {item.productImage ? (
                    <Image
                      source={{ uri: item.productImage }}
                      style={styles.msgProductImage}
                      resizeMode="cover"
                    />
                  ) : null}

                  {item.productPrice ? (
                    <Text style={[styles.msgProductPrice, isMyMessage && { color: '#a7f3d0' }]}>
                      ฿ {item.productPrice}
                    </Text>
                  ) : null}

                  <Text style={isMyMessage ? styles.myText : styles.theirText}>
                    {item.text}
                  </Text>
                  
                  <Text
                    style={[
                      styles.timeTextInside,
                      isMyMessage ? styles.myTimeText : styles.theirTimeText,
                    ]}
                  >
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* ช่องกรอกข้อความ */}
        <View style={styles.inputBarContainer}>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="พิมพ์ข้อความของคุณที่นี่..."
              value={inputText}
              onChangeText={setInputText}
              placeholderTextColor="#94a3b8"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.disabledSendBtn]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
  headerTitleBox: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  greenDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e' },
  statusText: { fontSize: 11, color: '#64748b' },
  moreBtn: { padding: 6 },

  productBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 10,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    elevation: 2,
  },
  productBannerImg: { width: 44, height: 44, borderRadius: 8 },
  productBannerTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  productBannerPrice: { fontSize: 13, fontWeight: 'bold', color: '#1a5d3a', marginTop: 2 },
  sendProductTagBtn: { backgroundColor: '#1a5d3a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  sendProductTagText: { fontSize: 11, fontWeight: 'bold', color: '#ffffff' },

  chatPadding: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  myMessageRow: { justifyContent: 'flex-end' },
  theirMessageRow: { justifyContent: 'flex-start' },

  msgAvatar: { width: 32, height: 32, borderRadius: 16, marginBottom: 2 },
  msgAvatarCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', marginBottom: 2 },

  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    elevation: 1,
  },
  myBubble: {
    backgroundColor: '#1a5d3a',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  
  msgProductImage: {
    width: 160,
    height: 120,
    borderRadius: 10,
    marginBottom: 6,
  },
  msgProductPrice: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1a5d3a',
    marginBottom: 2,
  },

  myText: { color: '#ffffff', fontSize: 14, lineHeight: 20 },
  theirText: { color: '#0f172a', fontSize: 14, lineHeight: 20 },
  timeTextInside: { fontSize: 9, marginTop: 4, alignSelf: 'flex-end' },
  myTimeText: { color: '#a7f3d0' },
  theirTimeText: { color: '#94a3b8' },

  inputBarContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textInput: { flex: 1, fontSize: 14, color: '#0f172a', maxHeight: 80, paddingVertical: 8 },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a5d3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledSendBtn: { backgroundColor: '#cbd5e1' },
});