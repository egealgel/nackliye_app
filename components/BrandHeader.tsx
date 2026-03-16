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

type Props = {
  title?: string;
  showFilterIcon?: boolean;
  onPressFilter?: () => void;
};

export default function BrandHeader({
  title = 'yüküstü',
  showFilterIcon = false,
  onPressFilter,
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

  return (
    <View style={[styles.wrapper, { paddingTop }]}>
      <ExpoStatusBar style="light" />
      <View style={styles.inner}>
        <View style={styles.spacer} />
        <Text
          style={styles.title}
          numberOfLines={1}
        >
          {title}
        </Text>
        {showFilterIcon ? (
          <TouchableOpacity
            onPress={onPressFilter}
            style={styles.iconBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="filter-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
    color: '#FFFFFF',
    letterSpacing: LETTER_SPACING,
    textAlign: 'center',
    flex: 1,
  },
  spacer: {
    width: 28,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
