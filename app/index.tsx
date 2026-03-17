import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import LottieView from 'lottie-react-native';
import { useAuth } from '@/lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const { session, isLoading, profileComplete } = useAuth();
  const router = useRouter();
  const animationRef = useRef<LottieView | null>(null);
  const didRouteRef = useRef(false);
  const [animationDone, setAnimationDone] = useState(false);

  useEffect(() => {
    // We are ready to show our Lottie splash, hide the native one
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (!animationDone || isLoading) return;
    if (didRouteRef.current) return;

    if (!session) {
      (async () => {
        try {
          const seen = await AsyncStorage.getItem('onboarding_seen');
          const isSeen = seen === 'true';
          didRouteRef.current = true;
          router.replace(isSeen ? '/(auth)/phone' : '/(auth)/onboarding');
        } catch {
          didRouteRef.current = true;
          router.replace('/(auth)/onboarding');
        }
      })();
      return;
    }

    if (!profileComplete) {
      didRouteRef.current = true;
      router.replace('/(auth)/complete-profile');
      return;
    }

    didRouteRef.current = true;
    router.replace('/(tabs)');
  }, [animationDone, isLoading, session, profileComplete, router]);

  return (
    <View style={styles.container}>
      <LottieView
        ref={animationRef}
        source={require('../assets/splash-animation.json')}
        autoPlay
        loop={false}
        onAnimationFinish={() => setAnimationDone(true)}
        style={styles.lottie}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
});
