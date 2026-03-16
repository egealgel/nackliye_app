import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/services/supabase';
import CityDistrictPicker from '@/components/create-load/CityDistrictPicker';
import {
  VehicleType,
  VEHICLE_LABELS,
  PhotoItem,
  isVehicleCompatible,
} from '@/types/load';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import BrandHeader from '@/components/BrandHeader';

const PRIMARY = '#2563EB';
const VEHICLE_OPTIONS: VehicleType[] = [
  'minivan',
  'kamyonet',
  'kamyon',
  'tir',
  'damperli',
];

async function compressAndUpload(
  uri: string,
  userId: string,
): Promise<string> {
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
    .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
  if (error) throw error;
  const { data: urlData } = supabase.storage
    .from('load-photos')
    .getPublicUrl(data.path);
  return urlData.publicUrl;
}

export default function EditLoadScreen() {
  const { loadId } = useLocalSearchParams<{ loadId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fromCity, setFromCity] = useState('');
  const [fromDistrict, setFromDistrict] = useState('');
  const [toCity, setToCity] = useState('');
  const [toDistrict, setToDistrict] = useState('');
  const [weight, setWeight] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('kamyonet');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(
    null,
  );

  useEffect(() => {
    if (!loadId) return;
    (async () => {
      const { data } = await supabase
        .from('loads')
        .select('*')
        .eq('id', loadId)
        .single();
      if (data) {
        setFromCity(data.from_city);
        setFromDistrict(data.from_district || '');
        setToCity(data.to_city);
        setToDistrict(data.to_district || '');
        setWeight(String(data.weight_kg));
        setWidthCm(data.width_cm ? String(data.width_cm) : '');
        setLengthCm(data.length_cm ? String(data.length_cm) : '');
        setHeightCm(data.height_cm ? String(data.height_cm) : '');
        setVehicleType(data.vehicle_type as VehicleType);
        setDescription(data.description || '');
        setPhotos(
          (data.photos || []).map((url: string) => ({
            uri: url,
            status: 'done' as const,
            url,
          })),
        );
      }
      setLoading(false);
    })();
  }, [loadId]);

  const handlePickPhotos = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
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
    if (result.canceled || !result.assets.length) return;

    setUploadingPhoto(true);
    for (const asset of result.assets) {
      try {
        const url = await compressAndUpload(asset.uri, userId);
        setPhotos((prev) => [...prev, { uri: url, status: 'done', url }]);
      } catch {
        Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
      }
    }
    setUploadingPhoto(false);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdate = async () => {
    const weightNum = parseFloat(weight);
    if (!fromCity || !toCity || !weightNum) {
      Alert.alert('Hata', 'Nereden, nereye ve ağırlık alanları zorunludur.');
      return;
    }

    setSubmitting(true);
    try {
      const photoUrls = photos
        .filter((p) => p.status === 'done' && p.url)
        .map((p) => p.url!);

      const { error } = await supabase
        .from('loads')
        .update({
          from_city: fromCity,
          from_district: fromDistrict,
          to_city: toCity,
          to_district: toDistrict,
          weight_kg: weightNum,
          width_cm: widthCm ? parseFloat(widthCm) : null,
          length_cm: lengthCm ? parseFloat(lengthCm) : null,
          height_cm: heightCm ? parseFloat(heightCm) : null,
          vehicle_type: vehicleType,
          description: description || null,
          photos: photoUrls,
          updated_at: new Date().toISOString(),
        })
        .eq('id', loadId)
        .eq('user_id', session?.user?.id);

      if (error) throw error;

      Alert.alert('Başarılı', 'Yük ilanınız güncellendi.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Güncelleme başarısız.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  const weightNum = parseFloat(weight) || 0;
  const canSubmit = !!fromCity && !!toCity && weightNum > 0 && !submitting;

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <BrandHeader
        title="Yük Düzenle"
        showBackButton
        onBackPress={() => router.back()}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.label}>Nereden</Text>
          <TouchableOpacity
            style={s.pickerBtn}
            onPress={() => setPickerTarget('from')}
          >
            <Text
              style={[s.pickerValue, !fromCity && s.pickerPlaceholder]}
            >
              {fromCity
                ? `${fromCity}${fromDistrict ? ' / ' + fromDistrict : ''}`
                : 'Şehir seçin'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <Text style={s.label}>Nereye</Text>
          <TouchableOpacity
            style={s.pickerBtn}
            onPress={() => setPickerTarget('to')}
          >
            <Text style={[s.pickerValue, !toCity && s.pickerPlaceholder]}>
              {toCity
                ? `${toCity}${toDistrict ? ' / ' + toDistrict : ''}`
                : 'Şehir seçin'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <Text style={s.label}>Ağırlık (kg)</Text>
          <TextInput
            style={s.input}
            value={weight}
            onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ''))}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#D1D5DB"
          />

          <Text style={s.label}>Boyutlar (cm) — opsiyonel</Text>
          <View style={s.dimRow}>
            <TextInput
              style={s.dimInput}
              value={widthCm}
              onChangeText={(t) => setWidthCm(t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="En"
              placeholderTextColor="#D1D5DB"
            />
            <TextInput
              style={s.dimInput}
              value={lengthCm}
              onChangeText={(t) => setLengthCm(t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="Boy"
              placeholderTextColor="#D1D5DB"
            />
            <TextInput
              style={s.dimInput}
              value={heightCm}
              onChangeText={(t) => setHeightCm(t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="Yükseklik"
              placeholderTextColor="#D1D5DB"
            />
          </View>

          <Text style={s.label}>Araç Tipi</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.vehicleRow}
          >
            {VEHICLE_OPTIONS.map((v) => {
              const active = vehicleType === v;
              const ok = isVehicleCompatible(v, weightNum);
              return (
                <TouchableOpacity
                  key={v}
                  style={[
                    s.vPill,
                    active && s.vPillActive,
                    !ok && s.vPillDisabled,
                  ]}
                  onPress={() => setVehicleType(v)}
                  disabled={!ok}
                >
                  <Text
                    style={[
                      s.vPillText,
                      active && s.vPillTextActive,
                      !ok && s.vPillTextDisabled,
                    ]}
                  >
                    {VEHICLE_LABELS[v]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={s.label}>Açıklama — opsiyonel</Text>
          <TextInput
            style={[s.input, s.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Yük hakkında ek bilgi..."
            placeholderTextColor="#D1D5DB"
            multiline
            maxLength={500}
          />

          <Text style={s.label}>Fotoğraflar</Text>
          <View style={s.photosGrid}>
            {photos.map((photo, i) => (
              <View key={`${photo.uri}-${i}`} style={s.photoWrap}>
                <Image
                  source={{ uri: photo.url || photo.uri }}
                  style={s.photoThumb}
                />
                <TouchableOpacity
                  style={s.photoRemove}
                  onPress={() => removePhoto(i)}
                >
                  <Ionicons name="close" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity
                style={s.addPhotoBtn}
                onPress={handlePickPhotos}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Ionicons name="add" size={32} color={PRIMARY} />
                )}
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={handleUpdate}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={s.submitBtnText}>Güncelle</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerTarget !== null}
        animationType="slide"
        onRequestClose={() => setPickerTarget(null)}
      >
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.modalHeader}>
            <TouchableOpacity
              onPress={() => setPickerTarget(null)}
              style={s.backBtn}
            >
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>
              {pickerTarget === 'from' ? 'Nereden?' : 'Nereye?'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            <CityDistrictPicker
              title=""
              selectedCity={pickerTarget === 'from' ? fromCity : toCity}
              selectedDistrict={
                pickerTarget === 'from' ? fromDistrict : toDistrict
              }
              onSelect={(city, district) => {
                if (pickerTarget === 'from') {
                  setFromCity(city);
                  setFromDistrict(district);
                } else {
                  setToCity(city);
                  setToDistrict(district);
                }
                setPickerTarget(null);
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },

  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  pickerValue: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  pickerPlaceholder: { color: '#9CA3AF', fontWeight: '400' },

  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  dimRow: { flexDirection: 'row', gap: 10 },
  dimInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
    textAlign: 'center',
  },

  vehicleRow: { marginBottom: 4 },
  vPill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    marginRight: 10,
  },
  vPillActive: { backgroundColor: PRIMARY },
  vPillDisabled: { opacity: 0.4 },
  vPillText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  vPillTextActive: { color: '#FFFFFF' },
  vPillTextDisabled: { color: '#9CA3AF' },

  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  photoWrap: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
  },
  photoThumb: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnDisabled: { backgroundColor: '#E5E7EB' },
  submitBtnText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
});
