import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from '@expo-google-fonts/inter';
import { Inter_900Black } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '@/lib/auth';
import { UnreadCountProvider } from '@/lib/UnreadCountContext';
import { initNotificationListeners, shouldSkipNotifications } from '@/services/notifications';
import { initAppSettingsCache, refreshAppSettingsCache } from '@/services/pushClient';
import { ToastProvider, useToast } from '@/components/ToastProvider';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

SplashScreen.preventAutoHideAsync();

function NotificationsInit() {
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      if (shouldSkipNotifications()) return;
      try {
        initNotificationListeners();
      } catch {
        // Silent: Expo Go / unsupported notification runtime
      }
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

function GlobalErrorHandlers() {
  const toast = useToast();

  useEffect(() => {
    const prevHandler = (globalThis as any).ErrorUtils?.getGlobalHandler?.();
    (globalThis as any).ErrorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
      try {
        console.error('Global error:', { error, isFatal });
      } catch {
        // ignore
      }
      toast('Bağlantı hatası, tekrar deneyin');
      if (typeof prevHandler === 'function') prevHandler(error, isFatal);
    });

    const prevRejection = (globalThis as any).onunhandledrejection;
    (globalThis as any).onunhandledrejection = (event: any) => {
      try {
        console.error('Unhandled promise rejection:', event?.reason ?? event);
      } catch {
        // ignore
      }
      toast('Bağlantı hatası, tekrar deneyin');
      if (typeof prevRejection === 'function') prevRejection(event);
    };

    return () => {
      if (typeof prevHandler === 'function') {
        (globalThis as any).ErrorUtils?.setGlobalHandler?.(prevHandler);
      }
      (globalThis as any).onunhandledrejection = prevRejection;
    };
  }, [toast]);

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
      <ToastProvider>
        <AppErrorBoundary>
          <AuthProvider>
            <NotificationsInit />
            <AppSettingsInit />
            <GlobalErrorHandlers />
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
        </AppErrorBoundary>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}
