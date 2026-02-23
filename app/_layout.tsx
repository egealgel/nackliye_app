import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth';
import { UnreadCountProvider } from '@/lib/UnreadCountContext';
import { initNotificationListeners } from '@/services/notifications';

function NotificationsInit() {
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      initNotificationListeners();
    }
  }, [session?.user?.id]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationsInit />
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
  );
}
