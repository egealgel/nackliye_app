import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type NetworkContextValue = {
  isOffline: boolean;
};

const NetworkContext = createContext<NetworkContextValue>({ isOffline: false });

export function useNetwork() {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);
  const prevConnectedRef = useRef<boolean | null>(null);
  const hideOnlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (globalThis as any).__YUKUSTU_IS_OFFLINE__ = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );

      if (prevConnectedRef.current === null) {
        prevConnectedRef.current = connected;
        setIsOffline(!connected);
        (globalThis as any).__YUKUSTU_IS_OFFLINE__ = !connected;
        return;
      }

      if (!connected) {
        setIsOffline(true);
        (globalThis as any).__YUKUSTU_IS_OFFLINE__ = true;
        setShowOnlineBanner(false);
        if (hideOnlineTimerRef.current) {
          clearTimeout(hideOnlineTimerRef.current);
          hideOnlineTimerRef.current = null;
        }
      } else {
        const wasOffline = prevConnectedRef.current === false;
        setIsOffline(false);
        (globalThis as any).__YUKUSTU_IS_OFFLINE__ = false;
        if (wasOffline) {
          setShowOnlineBanner(true);
          if (hideOnlineTimerRef.current) clearTimeout(hideOnlineTimerRef.current);
          hideOnlineTimerRef.current = setTimeout(() => {
            setShowOnlineBanner(false);
          }, 3000);
        }
      }

      prevConnectedRef.current = connected;
    });

    return () => {
      unsubscribe();
      if (hideOnlineTimerRef.current) clearTimeout(hideOnlineTimerRef.current);
      (globalThis as any).__YUKUSTU_IS_OFFLINE__ = false;
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOffline }}>
      {children}
      {isOffline ? (
        <View style={[styles.banner, styles.offlineBanner, { top: insets.top }]}>
          <MaterialCommunityIcons name="wifi-off" size={18} color="#FFFFFF" />
          <Text style={styles.bannerText}>İnternet bağlantısı yok</Text>
        </View>
      ) : showOnlineBanner ? (
        <View style={[styles.banner, styles.onlineBanner, { top: insets.top }]}>
          <MaterialCommunityIcons name="wifi" size={18} color="#FFFFFF" />
          <Text style={styles.bannerText}>Bağlantı sağlandı</Text>
        </View>
      ) : null}
    </NetworkContext.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  offlineBanner: {
    backgroundColor: '#EF4444',
  },
  onlineBanner: {
    backgroundColor: '#22C55E',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

