import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

type NetworkContextValue = {
  isOffline: boolean;
  bannerMode: 'offline' | 'online' | null;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOffline: false,
  bannerMode: null,
});

export function useNetwork() {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
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
    <NetworkContext.Provider
      value={{
        isOffline,
        bannerMode: isOffline ? 'offline' : showOnlineBanner ? 'online' : null,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

