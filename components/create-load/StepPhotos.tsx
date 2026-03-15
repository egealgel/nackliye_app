import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/services/supabase';
import { PhotoItem } from '@/types/load';

const PRIMARY = '#2563EB';
const GREEN = '#16A34A';

type Props = {
  photos: PhotoItem[];
  onPhotosChange: (photos: PhotoItem[] | ((prev: PhotoItem[]) => PhotoItem[])) => void;
  onNext: () => void;
  onSkip: () => void;
};

const UPLOAD_MAX_RETRIES = 3;
const UPLOAD_RETRY_DELAY_MS = 1000;

async function compressPhoto(uri: string): Promise<{ uri: string }> {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
}

async function uploadToStorage(
  manipulatedUri: string,
  userId: string,
  fileName: string,
): Promise<string> {
  const response = await fetch(manipulatedUri);
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

async function compressAndUploadPhotoWithRetry(
  uri: string,
  userId: string,
): Promise<string> {
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    try {
      const manipulated = await compressPhoto(uri);
      return await uploadToStorage(manipulated.uri, userId, fileName);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < UPLOAD_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, UPLOAD_RETRY_DELAY_MS));
      }
    }
  }
  throw lastError ?? new Error('Upload failed');
}

export default function StepPhotos({
  photos,
  onPhotosChange,
  onNext,
  onSkip,
}: Props) {
  const { session } = useAuth();
  const [cameraPreviewUri, setCameraPreviewUri] = useState<string | null>(null);

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

    let failedCount = 0;
    for (let i = 0; i < newItems.length; i++) {
      const uri = newItems[i].uri;
      try {
        const url = await compressAndUploadPhotoWithRetry(uri, userId);
        onPhotosChange((prev) => {
          const next = [...prev];
          const idx = next.findIndex((p) => p.uri === uri);
          if (idx >= 0) next[idx] = { uri, status: 'done', url };
          return next;
        });
      } catch {
        failedCount++;
        onPhotosChange((prev) => {
          const next = [...prev];
          const idx = next.findIndex((p) => p.uri === uri);
          if (idx >= 0) next[idx] = { uri, status: 'error' };
          return next;
        });
      }
    }
    if (failedCount > 0) {
      Alert.alert(
        'Yükleme hatası',
        `${failedCount} fotoğraf yüklenemedi, tekrar deneyin`,
      );
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
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setCameraPreviewUri(result.assets[0].uri);
    }
  };

  const handleUsePhoto = async () => {
    if (cameraPreviewUri) {
      setCameraPreviewUri(null);
      await addAndUpload([cameraPreviewUri]);
    }
  };

  const handleRetake = () => {
    setCameraPreviewUri(null);
    pickFromCamera();
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
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
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
                  <View style={styles.overlayContent}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.overlayText}>
                      Yükleniyor... ({photos.filter((p) => p.status === 'done').length + 1}/{photos.length})
                    </Text>
                  </View>
                </View>
              )}
              {photo.status === 'error' && (
                <View style={styles.overlay}>
                  <View style={styles.overlayContent}>
                    <Ionicons name="alert-circle" size={24} color="#FEE2E2" />
                    <Text style={styles.overlayText}>Yüklenemedi</Text>
                    <Text style={styles.overlaySubtext}>Tekrar deneyin veya kaldırın</Text>
                  </View>
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
        {photos.length}/5 fotoğraf
        {hasUploading
          ? ` yükleniyor... (${photos.filter((p) => p.status === 'done').length + 1}/${photos.length})`
          : ' eklendi'}
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

    <Modal visible={hasUploading} transparent animationType="fade">
      <View style={styles.uploadOverlay}>
        <View style={styles.uploadOverlayContent}>
          <ActivityIndicator size="small" color={PRIMARY} />
          <Text style={styles.uploadOverlayText}>Yükleniyor...</Text>
        </View>
      </View>
    </Modal>

    <Modal
      visible={!!cameraPreviewUri}
      transparent
      animationType="fade"
      onRequestClose={() => setCameraPreviewUri(null)}
    >
      <View style={styles.previewOverlay}>
        <View style={styles.previewContent}>
          {cameraPreviewUri && (
            <Image source={{ uri: cameraPreviewUri }} style={styles.previewImage} resizeMode="contain" />
          )}
          <View style={styles.previewButtons}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
              <Text style={styles.retakeButtonText}>Tekrar Çek</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.usePhotoButton} onPress={handleUsePhoto}>
              <Text style={styles.usePhotoButtonText}>Fotoğrafı Kullan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    marginTop: 6,
  },
  overlaySubtext: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 999,
  },
  uploadOverlayContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOverlayText: {
    fontSize: 4,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 12,
    textAlign: 'center',
    width: '100%',
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
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewContent: {
    width: '100%',
    maxHeight: '80%',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 24,
  },
  previewButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  usePhotoButton: {
    flex: 1,
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  usePhotoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
