import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import LottieView from 'lottie-react-native';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, isLoading, profileComplete } = useAuth();
  const router = useRouter();
  const animationRef = useRef<LottieView | null>(null);
  const [animationDone, setAnimationDone] = useState(false);

  useEffect(() => {
    // We are ready to show our Lottie splash, hide the native one
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (!animationDone || isLoading) return;

    if (!session) {
      router.replace('/(auth)/phone');
      return;
    }

    if (!profileComplete) {
      router.replace('/(auth)/complete-profile');
      return;
    }

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
