import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import RouteDisplay from '@/components/RouteDisplay';
import {
  LoadFormData,
  VEHICLE_LABELS,
  VEHICLE_ICONS,
  formatWeight,
} from '@/types/load';

const PRIMARY = '#2563EB';

type Props = {
  formData: LoadFormData;
  onPublish: () => void;
  isSubmitting: boolean;
};

export default function StepReview({
  formData,
  onPublish,
  isSubmitting,
}: Props) {
  const hasDimensions = formData.width || formData.length || formData.height;
  const hasUploadingPhotos = formData.photos.some((p) => p.status === 'uploading');
  const canPublish = !isSubmitting && !hasUploadingPhotos;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <Text style={styles.title}>Özet</Text>
      <Text style={styles.subtitle}>İlanınızı kontrol edin</Text>

      <View style={styles.card}>
        <View style={styles.routeContainer}>
          <RouteDisplay
            fromCity={formData.fromCity}
            fromDistrict={formData.fromDistrict}
            toCity={formData.toCity}
            toDistrict={formData.toDistrict}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Ağırlık</Text>
            <Text style={styles.infoValue}>
              {formatWeight(formData.weight)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Araç</Text>
            <View style={styles.vehicleRow}>
              <MaterialCommunityIcons
                name={VEHICLE_ICONS[formData.vehicleType] as any}
                size={20}
                color="#374151"
              />
              <Text style={styles.infoValue}>
                {VEHICLE_LABELS[formData.vehicleType]}
              </Text>
            </View>
          </View>
        </View>

        {hasDimensions && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Boyut</Text>
              <Text style={styles.infoValue}>
                {[
                  formData.width && `${formData.width} cm`,
                  formData.length && `${formData.length} cm`,
                  formData.height && `${formData.height} cm`,
                ]
                  .filter(Boolean)
                  .join(' × ')}
              </Text>
            </View>
          </>
        )}

        {formData.photos.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.infoLabel}>
              Fotoğraflar ({formData.photos.length})
              {hasUploadingPhotos && ' (yükleniyor...)'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photosRow}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {formData.photos.map((photo, i) => (
                <View key={`${photo.uri}-${i}`} style={styles.photoWrapper}>
                  <Image
                    source={{ uri: photo.url || photo.uri }}
                    style={styles.photo}
                  />
                  {photo.status === 'done' && (
                    <View style={styles.photoCheck}>
                      <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {formData.description.trim().length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.infoLabel}>Açıklama</Text>
            <Text style={styles.descriptionText}>
              {formData.description}
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.publishButton, !canPublish && styles.publishButtonDisabled]}
        onPress={onPublish}
        disabled={!canPublish}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
            <Text style={styles.publishButtonText}>Yayınla</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
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
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  routeContainer: {
    width: '100%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photosRow: {
    marginTop: 8,
  },
  photoWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  photoCheck: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
  },
  descriptionText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginTop: 4,
  },
  publishButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  publishButtonDisabled: {
    opacity: 0.7,
  },
  publishButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
