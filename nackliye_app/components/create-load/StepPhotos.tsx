import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';

const PRIMARY = '#FF6B35';

type Props = {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onNext: () => void;
  onSkip: () => void;
};

export default function StepPhotos({
  photos,
  onPhotosChange,
  onNext,
  onSkip,
}: Props) {
  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kamera izni gereklidir.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      onPhotosChange([...photos, result.assets[0].uri]);
    }
  };

  const pickFromGallery = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeri izni gereklidir.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map((a) => a.uri);
      onPhotosChange([...photos, ...newUris].slice(0, 5));
    }
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Fotoğraf ekle</Text>
      <Text style={styles.subtitle}>Yükünüzün fotoğraflarını ekleyin</Text>

      <View style={styles.encouragement}>
        <FontAwesome name="star" size={18} color="#F59E0B" />
        <Text style={styles.encouragementText}>
          Fotoğraflı ilanlar öne çıkar!
        </Text>
      </View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.pickButton}
          onPress={pickFromCamera}
          activeOpacity={0.7}
        >
          <FontAwesome name="camera" size={28} color={PRIMARY} />
          <Text style={styles.pickButtonText}>Kamera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pickButton}
          onPress={pickFromGallery}
          activeOpacity={0.7}
        >
          <FontAwesome name="image" size={28} color={PRIMARY} />
          <Text style={styles.pickButtonText}>Galeri</Text>
        </TouchableOpacity>
      </View>

      {photos.length > 0 && (
        <View style={styles.photosGrid}>
          {photos.map((uri, index) => (
            <View key={uri} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePhoto(index)}
              >
                <FontAwesome name="times" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.countText}>
        {photos.length}/5 fotoğraf eklendi
      </Text>

      {photos.length > 0 ? (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={onNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>Devam Et</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Atla →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  encouragement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 10,
  },
  encouragementText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  pickButton: {
    flex: 1,
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFEDD5',
    borderStyle: 'dashed',
    gap: 10,
  },
  pickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  photoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  nextButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
  },
  skipButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
});
