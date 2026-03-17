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

const HEADER_BG = '#2563EB';
const TITLE_FONT_SIZE = 24;
const LETTER_SPACING = 0.02 * TITLE_FONT_SIZE; // 0.48
/** Equal-width slots so title stays centered with or without filter/back */
const SLOT_WIDTH = 88;

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
      <View style={styles.inner}>
        <View style={styles.slot}>
          {leftSlot}
        </View>
        <Text
          style={styles.title}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={styles.slot}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  slot: {
    width: SLOT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
});
