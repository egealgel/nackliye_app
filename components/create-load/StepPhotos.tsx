import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/services/supabase';
import { PhotoItem } from '@/types/load';

const PRIMARY = '#FF6B35';
const GREEN = '#16A34A';

type Props = {
  photos: PhotoItem[];
  onPhotosChange: (photos: PhotoItem[] | ((prev: PhotoItem[]) => PhotoItem[])) => void;
  onNext: () => void;
  onSkip: () => void;
};

async function compressAndUploadPhoto(uri: string, userId: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );

  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

  const response = await fetch(manipulated.uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const { data, error } = await supabase.storage
    .from('load-photos')
    .upload(fileName, arrayBuffer, {
      contentType: 'image/jpeg',
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('load-photos')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export default function StepPhotos({
  photos,
  onPhotosChange,
  onNext,
  onSkip,
}: Props) {
  const { session } = useAuth();

  const addAndUpload = async (uris: string[]) => {
    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert('Hata', 'Oturum açmanız gerekiyor.');
      return;
    }

    const newItems: PhotoItem[] = uris.map((uri) => ({
      uri,
      status: 'uploading' as const,
    }));
    onPhotosChange([...photos, ...newItems].slice(0, 5));

    for (let i = 0; i < newItems.length; i++) {
      const uri = newItems[i].uri;
      const insertIndex = photos.length + i;
      try {
        const url = await compressAndUploadPhoto(uri, userId);
        onPhotosChange((prev) => {
          const next = [...prev];
          const idx = next.findIndex((p) => p.uri === uri);
          if (idx >= 0) next[idx] = { uri, status: 'done', url };
          return next;
        });
      } catch (err: any) {
        onPhotosChange((prev) => {
          const next = [...prev];
          const idx = next.findIndex((p) => p.uri === uri);
          if (idx >= 0) next[idx] = { uri, status: 'error' };
          return next;
        });
        Alert.alert('Yükleme hatası', err.message || 'Fotoğraf yüklenemedi.');
      }
    }
  };

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
      await addAndUpload([result.assets[0].uri]);
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
      const uris = result.assets.map((a) => a.uri);
      await addAndUpload(uris);
    }
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const hasUploading = photos.some((p) => p.status === 'uploading');
  const canProceed = photos.length > 0 && !hasUploading;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Fotoğraf ekle</Text>
      <Text style={styles.subtitle}>Yükünüzün fotoğraflarını ekleyin</Text>

      <View style={styles.encouragement}>
        <Ionicons name="star" size={18} color="#F59E0B" />
        <Text style={styles.encouragementText}>
          Fotoğraflı ilanlar öne çıkar!
        </Text>
      </View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.pickButton}
          onPress={pickFromCamera}
          activeOpacity={0.7}
          disabled={hasUploading || photos.length >= 5}
        >
          <Ionicons name="camera" size={32} color={PRIMARY} />
          <Text style={styles.pickButtonText}>Kamera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pickButton}
          onPress={pickFromGallery}
          activeOpacity={0.7}
          disabled={hasUploading || photos.length >= 5}
        >
          <Ionicons name="images" size={32} color={PRIMARY} />
          <Text style={styles.pickButtonText}>Galeri</Text>
        </TouchableOpacity>
      </View>

      {photos.length > 0 && (
        <View style={styles.photosGrid}>
          {photos.map((photo, index) => (
            <View key={`${photo.uri}-${index}`} style={styles.photoWrapper}>
              <Image
                source={{ uri: photo.uri }}
                style={styles.photo}
              />
              {photo.status === 'uploading' && (
                <View style={styles.overlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.overlayText}>Yükleniyor...</Text>
                </View>
              )}
              {photo.status === 'done' && (
                <View style={styles.checkOverlay}>
                  <Ionicons name="checkmark-circle" size={32} color={GREEN} />
                </View>
              )}
              {photo.status !== 'uploading' && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      <Text style={styles.countText}>
        {photos.length}/5 fotoğraf{hasUploading ? ' yükleniyor...' : ' eklendi'}
      </Text>

      {photos.length > 0 ? (
        <TouchableOpacity
          style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
          onPress={onNext}
          disabled={!canProceed}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  checkOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
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
  nextButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#868e96',
  },
});
