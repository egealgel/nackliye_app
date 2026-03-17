import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = '#2563EB';
const ONBOARDING_SEEN_KEY = 'onboarding_seen';

type Page = {
  key: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
};

const PAGES: Page[] = [
  {
    key: 'share',
    icon: 'truck-fast-outline',
    title: 'Yükünü Paylaş',
    subtitle: 'Taşınmasını istediğin yükü kolayca paylaş, binlerce sürücüye ulaş.',
  },
  {
    key: 'trust',
    icon: 'handshake-outline',
    title: 'Güvenilir Sürücü Bul',
    subtitle: 'Puanlama sistemiyle en güvenilir sürücüyü seç.',
  },
  {
    key: 'chat',
    icon: 'chat-processing-outline',
    title: 'Güvenli İletişim',
    subtitle: 'Uygulama içi mesajlaşma ve arama ile güvenle iletişim kur.',
  },
];

export default function OnboardingScreen() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const { width } = Dimensions.get('window');

  const isLast = pageIndex === PAGES.length - 1;

  const dots = useMemo(() => {
    return PAGES.map((_, i) => (
      <View
        key={`dot-${i}`}
        style={[styles.dot, i === pageIndex ? styles.dotActive : styles.dotInactive]}
      />
    ));
  }, [pageIndex]);

  const setSeenAndGoLogin = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    } catch {
      // silent
    }
    router.replace('/(auth)/phone');
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / width);
      if (next !== pageIndex) setPageIndex(next);
    },
    [pageIndex, width],
  );

  const goNext = useCallback(() => {
    const next = Math.min(pageIndex + 1, PAGES.length - 1);
    scrollRef.current?.scrollTo({ x: next * width, y: 0, animated: true });
    setPageIndex(next);
  }, [pageIndex, width]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={setSeenAndGoLogin}
          activeOpacity={0.8}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Geç</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={(r) => {
          scrollRef.current = r;
        }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {PAGES.map((p) => (
          <View key={p.key} style={[styles.page, { width }]}>
            <MaterialCommunityIcons name={p.icon} size={120} color="#FFFFFF" />
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.subtitle}>{p.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dotsRow}>{dots}</View>
        <TouchableOpacity
          style={styles.cta}
          onPress={isLast ? setSeenAndGoLogin : goNext}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{isLast ? 'Başla' : 'Sonraki'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  topBar: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 20,
    fontFamily: 'Inter_900Black',
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.56,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 18,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    lineHeight: 26,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  cta: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: PRIMARY,
    fontSize: 20,
    fontWeight: '800',
  },
});

