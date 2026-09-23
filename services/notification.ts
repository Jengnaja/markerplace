import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import Constants from 'expo-constants';
import { auth, db } from './firebase';

// ดึง projectId จาก app.json
const projectId =
  Constants?.expoConfig?.extra?.eas?.projectId ??
  Constants?.easConfig?.projectId;

// ตั้งค่าให้แสดงการ์ดแจ้งเตือนและเล่นเสียงขณะเปิดแอปอยู่
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 1. ขอสิทธิ์และสร้าง Notification Channel (Android)
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log('Push Notifications ต้องทดสอบบนอุปกรณ์จริงเท่านั้น');
    return;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } =
      await Notifications.requestPermissionsAsync();

    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('ผู้ใช้ปฏิเสธการรับการแจ้งเตือน');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chat-messages', {
      name: 'ข้อความแชท',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1a5d3a',
      sound: 'notification.wav',
    });
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: projectId,
  });

  const token = tokenData.data;

  const currentUser = auth.currentUser;

  if (currentUser && token) {
    await updateDoc(
      doc(db, 'users', currentUser.uid),
      {
        pushToken: token,
      }
    );
  }

  return token;
}

// 2. ฟังก์ชันยิงแจ้งเตือนผ่าน Expo Push API
export async function sendPushNotification(
  targetPushToken: string,
  title: string,
  body: string,
  chatId: string
) {
  if (!targetPushToken) return;

  const message = {
    to: targetPushToken,
    sound: 'notification.wav',
    title: title,
    body: body,
    data: { chatId: chatId },
    channelId: 'chat-messages',
  };

  try {
    const response = await fetch(
      'https://exp.host/--/api/v2/push/send',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    const result = await response.json();
    return result;
  } catch (error) {
    console.log(
      'Error sending push notification:',
      error
    );
  }
}