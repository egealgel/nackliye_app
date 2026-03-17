import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from '@expo-google-fonts/inter';
import { Inter_900Black } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '@/lib/auth';
import { UnreadCountProvider } from '@/lib/UnreadCountContext';
import { initNotificationListeners } from '@/services/notifications';
import { initAppSettingsCache, refreshAppSettingsCache } from '@/services/pushClient';

SplashScreen.preventAutoHideAsync();

function NotificationsInit() {
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      initNotificationListeners();
    }
  }, [session?.user?.id]);

  return null;
}

function AppSettingsInit() {
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    initAppSettingsCache().then(() => {});
    interval = setInterval(() => {
      refreshAppSettingsCache().then(() => {});
    }, 30 * 60 * 1000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NotificationsInit />
        <AppSettingsInit />
        <UnreadCountProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="edit-load" />
            <Stack.Screen name="my-load-detail" />
          </Stack>
          <StatusBar style="dark" />
        </UnreadCountProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
