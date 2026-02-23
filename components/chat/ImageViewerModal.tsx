import React, { useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  type ViewToken,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Single image (chat usage) */
  imageUri?: string | null;
  /** Gallery of images (load photos) */
  images?: string[];
  /** Which image to show first when opening in gallery mode */
  initialIndex?: number;
};

export default function ImageViewerModal({
  visible,
  onClose,
  imageUri,
  images,
  initialIndex = 0,
}: Props) {
  const gallery = images && images.length > 0 ? images : imageUri ? [imageUri] : [];
  const isGallery = gallery.length > 1;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [saving, setSaving] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const hasScrolledToInitial = useRef(false);

  const activeUri = gallery[currentIndex] ?? gallery[0] ?? null;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleSave = async () => {
    if (!activeUri) return;

    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'İzin Gerekli',
          'Fotoğrafı kaydetmek için galeri izni gereklidir.',
        );
        setSaving(false);
        return;
      }

      const tempPath = `${FileSystem.cacheDirectory}yukustu-${Date.now()}.jpg`;
      const { uri } = await FileSystem.downloadAsync(activeUri, tempPath);
      await MediaLibrary.saveToLibraryAsync(uri);

      Alert.alert('Başarılı', 'Fotoğraf galeriye kaydedildi.');
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Fotoğraf kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleLayout = useCallback(() => {
    if (!hasScrolledToInitial.current && initialIndex > 0 && gallery.length > 1) {
      hasScrolledToInitial.current = true;
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [initialIndex, gallery.length]);

  const handleClose = () => {
    hasScrolledToInitial.current = false;
    setCurrentIndex(initialIndex);
    onClose();
  };

  if (!visible || gallery.length === 0) return null;

  const renderItem = ({ item }: { item: string }) => (
    <View style={styles.page}>
      <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {isGallery ? (
          <FlatList
            ref={flatListRef}
            data={gallery}
            renderItem={renderItem}
            keyExtractor={(item, i) => `${item}-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            initialScrollIndex={initialIndex}
            onLayout={handleLayout}
            style={styles.flatList}
          />
        ) : (
          <View style={styles.page}>
            <Image
              source={{ uri: gallery[0] }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}

        {isGallery && (
          <View style={styles.indicator}>
            <Text style={styles.indicatorText}>
              {currentIndex + 1} / {gallery.length}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flatList: {
    flex: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  indicatorText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
