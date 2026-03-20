import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetwork } from '@/components/NetworkProvider';

const HEADER_BG = '#2563EB';
const TITLE_FONT_SIZE = 24;
const LETTER_SPACING = 0.02 * TITLE_FONT_SIZE; // 0.48
/** Equal-width slots so title stays centered with or without filter/back */
const SLOT_WIDTH = 88;
const HEADER_CONTENT_HEIGHT = 56;
const HEADER_BOTTOM_PADDING = 12;

type Props = {
  title?: string;
  showFilterIcon?: boolean;
  onPressFilter?: () => void;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightElement?: React.ReactNode;
};

export default function BrandHeader({
  title = 'yüküstü',
  showFilterIcon = false,
  onPressFilter,
  showBackButton = false,
  onBackPress,
  rightElement,
}: Props) {
  const insets = useSafeAreaInsets();
  const { bannerMode } = useNetwork();

  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor(HEADER_BG);
    }
  }, []);

  const paddingTop =
    (Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0) +
    insets.top;

  const leftSlot = showBackButton ? (
    <TouchableOpacity
      onPress={onBackPress}
      style={styles.slotTouchable}
      activeOpacity={0.7}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  ) : (
    <View style={styles.slotSpacer} />
  );

  const rightSlot = rightElement ?? (showFilterIcon ? (
    <TouchableOpacity
      onPress={onPressFilter}
      style={styles.slotTouchable}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="filter-outline" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  ) : (
    <View style={styles.slotSpacer} />
  ));

  return (
    <View style={[styles.wrapper, { paddingTop }]}>
      <ExpoStatusBar style="light" />
      {bannerMode ? (
        <View
          style={[
            styles.netBanner,
            bannerMode === 'offline' ? styles.netBannerOffline : styles.netBannerOnline,
          ]}
        >
          <MaterialCommunityIcons
            name={bannerMode === 'offline' ? 'wifi-off' : 'wifi'}
            size={13}
            color="#FFFFFF"
          />
          <Text style={styles.netBannerText}>
            {bannerMode === 'offline' ? 'İnternet bağlantısı yok' : 'Bağlantı sağlandı'}
          </Text>
        </View>
      ) : null}
      <View style={styles.inner}>
        <View style={[styles.slot, styles.leftSlot]}>
          {leftSlot}
        </View>
        <Text
          style={styles.title}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={[styles.slot, styles.rightSlot]}>
          {rightSlot}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    backgroundColor: HEADER_BG,
  },
  inner: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: HEADER_BOTTOM_PADDING,
  },
  netBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6,
  },
  netBannerOffline: {
    backgroundColor: '#EF4444',
  },
  netBannerOnline: {
    backgroundColor: '#22C55E',
  },
  netBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  slot: {
    width: SLOT_WIDTH,
    height: 40,
    justifyContent: 'center',
  },
  leftSlot: {
    alignItems: 'flex-start',
  },
  rightSlot: {
    alignItems: 'flex-end',
  },
  slotSpacer: {
    width: '100%',
  },
  slotTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
    color: '#FFFFFF',
    letterSpacing: LETTER_SPACING,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
