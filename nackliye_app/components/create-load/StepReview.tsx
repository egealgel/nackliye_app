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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  LoadFormData,
  VEHICLE_LABELS,
  VEHICLE_ICONS,
  formatWeight,
  formatRoute,
} from '@/types/load';

const PRIMARY = '#FF6B35';

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
  const route = formatRoute(
    formData.fromCity,
    formData.fromDistrict,
    formData.toCity,
    formData.toDistrict,
  );

  const hasDimensions = formData.width || formData.length || formData.height;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Özet</Text>
      <Text style={styles.subtitle}>İlanınızı kontrol edin</Text>

      <View style={styles.card}>
        <View style={styles.routeContainer}>
          <FontAwesome name="map-marker" size={18} color={PRIMARY} />
          <Text style={styles.routeText}>{route}</Text>
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
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photosRow}
            >
              {formData.photos.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.photo} />
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
        style={[styles.publishButton, isSubmitting && styles.publishButtonDisabled]}
        onPress={onPublish}
        disabled={isSubmitting}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <FontAwesome name="check-circle" size={22} color="#FFFFFF" />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 26,
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
  photo: {
    width: 72,
    height: 72,
    borderRadius: 10,
    marginRight: 8,
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
