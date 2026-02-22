import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';

const NOTIFICATION_REQUESTED_KEY = 'notification_permission_requested';

// Show notifications as alerts when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and return the Expo push token.
 * Call on app start when user is logged in.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) {
    console.warn('Push notifications: EAS projectId not found. Add extra.eas.projectId to app.json or EXPO_PUBLIC_EAS_PROJECT_ID env.');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Varsayılan',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return tokenData.data;
}

/**
 * Save the Expo push token to the user's profile in Supabase.
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', userId);
}

/**
 * Clear the push token from the user's profile (e.g. on sign out).
 */
export async function clearPushToken(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ expo_push_token: null })
    .eq('id', userId);
}

let listenersSetup = false;

/**
 * Setup notification listeners (once):
 * - Foreground: show in-app alert
 * - Tap: deep link to chat or load
 */
function setupNotificationListeners(): void {
  if (listenersSetup) return;
  listenersSetup = true;

  Notifications.addNotificationReceivedListener((notification) => {
    const { title, body } = notification.request.content;
    Alert.alert(title ?? 'Bildirim', body ?? '');
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    handleNotificationTap(data);
  });
}

/**
 * Handle deep link from notification tap.
 * data may include: type, loadId, otherUserId, otherUserName, otherUserPhone, fromCity, fromDistrict, toCity, toDistrict
 */
function handleNotificationTap(data: Record<string, unknown>): void {
  const type = data?.type as string | undefined;
  const loadId = data?.loadId as string | undefined;
  const otherUserId = data?.otherUserId as string | undefined;

  if (type === 'chat' && loadId && otherUserId) {
    router.push({
      pathname: '/chat',
      params: {
        loadId,
        otherUserId,
        otherUserName: (data?.otherUserName as string) ?? '',
        otherUserPhone: (data?.otherUserPhone as string) ?? '',
        fromCity: (data?.fromCity as string) ?? '',
        fromDistrict: (data?.fromDistrict as string) ?? '',
        toCity: (data?.toCity as string) ?? '',
        toDistrict: (data?.toDistrict as string) ?? '',
      },
    });
    return;
  }

  // Load detail: open home where loads are listed
  if (type === 'load' && loadId) {
    router.push('/(tabs)');
    return;
  }

  if (loadId) {
    router.push('/(tabs)/messages');
  }
}

/**
 * Setup listeners only. Call on app launch when user is logged in.
 */
export function initNotificationListeners(): void {
  setupNotificationListeners();
}

/**
 * Request notification permission after first meaningful action (first load or first message).
 * Shows a friendly Turkish prompt before the system dialog.
 * Call from create-load (after success) and chat (after first message send).
 */
export async function requestNotificationsAfterFirstAction(userId: string): Promise<void> {
  try {
    const requested = await AsyncStorage.getItem(NOTIFICATION_REQUESTED_KEY);
    if (requested === 'true') return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') {
      await AsyncStorage.setItem(NOTIFICATION_REQUESTED_KEY, 'true');
      const token = await registerForPushNotifications();
      if (token) await savePushToken(userId, token);
      return;
    }

    Alert.alert(
      'Bildirimler',
      'Yeni mesaj ve yük bildirimlerini kaçırmamak için bildirimlere izin verin.',
      [
        { text: 'Şimdi Değil', style: 'cancel' },
        {
          text: 'İzin Ver',
          onPress: async () => {
            await AsyncStorage.setItem(NOTIFICATION_REQUESTED_KEY, 'true');
            const token = await registerForPushNotifications();
            if (token) await savePushToken(userId, token);
          },
        },
      ]
    );
  } catch {
    // Silent fail
  }
}
