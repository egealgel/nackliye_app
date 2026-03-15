import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/services/supabase';
import { requestNotificationsAfterFirstAction } from '@/services/notifications';
import { LoadFormData, PhotoItem, VehicleType, suggestVehicleType } from '@/types/load';
import ProgressBar from '@/components/create-load/ProgressBar';
import CityDistrictPicker from '@/components/create-load/CityDistrictPicker';
import StepWeight from '@/components/create-load/StepWeight';
import StepDimensions from '@/components/create-load/StepDimensions';
import StepVehicle from '@/components/create-load/StepVehicle';
import StepPhotos from '@/components/create-load/StepPhotos';
import StepDescription from '@/components/create-load/StepDescription';
import StepReview from '@/components/create-load/StepReview';

const TOTAL_STEPS = 8;
const PRIMARY = '#2563EB';

type CreateMode = 'yuk' | 'bos_arac';

const INITIAL_FORM: LoadFormData = {
  fromCity: '',
  fromDistrict: '',
  toCity: '',
  toDistrict: '',
  weight: 0,
  vehicleType: 'kamyonet',
  photos: [],
  description: '',
};

function resetFormState(
  setStep: (n: number) => void,
  setFormData: (d: LoadFormData) => void,
  setBosAracText: (s: string) => void,
  setCreateMode: (m: CreateMode) => void,
  setIsSubmitting: (b: boolean) => void,
  setIsRedirecting: (b: boolean) => void,
) {
  setStep(1);
  setFormData(INITIAL_FORM);
  setBosAracText('');
  setCreateMode('yuk');
  setIsSubmitting(false);
  setIsRedirecting(false);
}

export default function CreateLoadScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [createMode, setCreateMode] = useState<CreateMode>('yuk');
  const [bosAracText, setBosAracText] = useState('');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<LoadFormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Clear loading/redirect state when screen is focused (fixes spinner when reopening after a previous create)
  useFocusEffect(
    useCallback(() => {
      setIsRedirecting(false);
      setIsSubmitting(false);
    }, []),
  );

  const goNext = useCallback(
    () => setStep((s) => Math.min(s + 1, TOTAL_STEPS)),
    [],
  );
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  const handleGeri = useCallback(() => {
    if (createMode === 'bos_arac') {
      Alert.alert(
        'İptal et',
        'Boş araç paylaşımını iptal etmek istediğinize emin misiniz?',
        [
          { text: 'Hayır', style: 'cancel' },
          { text: 'Evet, iptal et', style: 'destructive', onPress: () => router.back() },
        ],
      );
      return;
    }
    if (step === 1) {
      Alert.alert(
        'İlanı iptal et',
        'İlanı iptal etmek istediğinize emin misiniz?',
        [
          { text: 'Hayır', style: 'cancel' },
          {
            text: 'Evet, iptal et',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ],
      );
    } else {
      goBack();
    }
  }, [createMode, step, goBack, router]);

  const updateForm = useCallback((updates: Partial<LoadFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const setPhotos = useCallback(
    (update: PhotoItem[] | ((prev: PhotoItem[]) => PhotoItem[])) => {
      setFormData((prev) => ({
        ...prev,
        photos: typeof update === 'function' ? update(prev.photos) : update,
      }));
    },
    [],
  );

  const handlePublishBosArac = async () => {
    if (!session?.user?.id) {
      Alert.alert('Hata', 'Lütfen giriş yapın.');
      return;
    }
    const text = bosAracText.trim();
    if (!text) {
      Alert.alert('Uyarı', 'Lütfen boş aracınızı tanımlayın.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('loads')
        .insert({
          user_id: session.user.id,
          from_city: null,
          from_district: null,
          to_city: null,
          to_district: null,
          weight_kg: null,
          width_cm: null,
          length_cm: null,
          height_cm: null,
          vehicle_type: 'bos_arac',
          photos: [],
          description: text,
          status: 'active',
        })
        .select('id')
        .single();

      if (error) throw error;

      requestNotificationsAfterFirstAction(session.user.id);

      Alert.alert('Başarılı!', 'Boş araç ilanınız yayınlandı.', [
        {
          text: 'Tamam',
          onPress: () => {
            resetFormState(
              setStep,
              setFormData,
              setBosAracText,
              setCreateMode,
              setIsSubmitting,
              setIsRedirecting,
            );
            setIsRedirecting(true);
            setTimeout(() => router.replace('/(tabs)'), 500);
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!session?.user?.id) {
      Alert.alert('Hata', 'Lütfen giriş yapın.');
      return;
    }

    setIsSubmitting(true);
    try {
      const photoUrls = formData.photos
        .filter((p) => p.status === 'done' && p.url)
        .map((p) => p.url!);

      const { data: newLoad, error } = await supabase
        .from('loads')
        .insert({
          user_id: session.user.id,
          from_city: formData.fromCity,
          from_district: formData.fromDistrict,
          to_city: formData.toCity,
          to_district: formData.toDistrict,
          weight_kg: formData.weight,
          width_cm: formData.width || null,
          length_cm: formData.length || null,
          height_cm: formData.height || null,
          vehicle_type: formData.vehicleType,
          photos: photoUrls,
          description: formData.description || null,
          status: 'active',
        })
        .select('id, from_city, from_district, to_city, to_district, weight_kg')
        .single();

      if (error) throw error;

      const bodyText = `${formData.fromCity}${formData.fromDistrict ? '/' + formData.fromDistrict : ''} → ${formData.toCity}${formData.toDistrict ? '/' + formData.toDistrict : ''} | ${formData.weight} kg`;
      const { data: matchingProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('city', formData.fromCity)
        .eq('vehicle_type', formData.vehicleType)
        .neq('id', session.user.id);

      if (matchingProfiles?.length) {
        for (const p of matchingProfiles) {
          try {
            await supabase.functions.invoke('send-notification', {
              body: {
                user_id: p.id,
                title: 'Yeni Yük',
                body: bodyText,
                data: { type: 'load', loadId: newLoad.id },
              },
            });
          } catch {
            // Silent fail for push
          }
        }
      }

      requestNotificationsAfterFirstAction(session.user.id);

      Alert.alert('Başarılı!', 'Yük ilanınız yayınlandı.', [
        {
          text: 'Tamam',
          onPress: () => {
            resetFormState(
              setStep,
              setFormData,
              setBosAracText,
              setCreateMode,
              setIsSubmitting,
              setIsRedirecting,
            );
            setIsRedirecting(true);
            setTimeout(() => router.replace('/(tabs)'), 500);
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        'Hata',
        error.message || 'Bir hata oluştu. Lütfen tekrar deneyin.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <CityDistrictPicker
            key="origin"
            title="Nereden?"
            selectedCity={formData.fromCity}
            selectedDistrict={formData.fromDistrict}
            onSelect={(city, district) => {
              updateForm({ fromCity: city, fromDistrict: district });
              goNext();
            }}
          />
        );
      case 2:
        return (
          <CityDistrictPicker
            key="destination"
            title="Nereye?"
            selectedCity={formData.toCity}
            selectedDistrict={formData.toDistrict}
            onSelect={(city, district) => {
              updateForm({ toCity: city, toDistrict: district });
              goNext();
            }}
          />
        );
      case 3:
        return (
          <StepWeight
            weight={formData.weight}
            onWeightChange={(weight) => updateForm({ weight })}
            onNext={() => {
              updateForm({
                vehicleType: suggestVehicleType(formData.weight),
              });
              goNext();
            }}
          />
        );
      case 4:
        return (
          <StepDimensions
            width={formData.width}
            length={formData.length}
            height={formData.height}
            onDimensionsChange={(dims) => updateForm(dims)}
            onNext={goNext}
            onSkip={goNext}
          />
        );
      case 5:
        return (
          <StepVehicle
            vehicleType={formData.vehicleType}
            weight={formData.weight}
            onVehicleSelect={(vehicleType: VehicleType) =>
              updateForm({ vehicleType })
            }
            onNext={goNext}
          />
        );
      case 6:
        return (
          <StepPhotos
            photos={formData.photos}
            onPhotosChange={setPhotos}
            onNext={goNext}
            onSkip={goNext}
          />
        );
      case 7:
        return (
          <StepDescription
            description={formData.description}
            onDescriptionChange={(description) => updateForm({ description })}
            onNext={goNext}
            onSkip={goNext}
          />
        );
      case 8:
        return (
          <StepReview
            formData={formData}
            onPublish={handlePublish}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>
      {isRedirecting && (
        <View style={styles.redirectOverlay}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleGeri}
          style={styles.geriButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#1F2937" />
          <Text style={styles.geriText}>Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {createMode === 'bos_arac' ? 'Boş Araç Paylaş' : 'Yük Oluştur'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, createMode === 'yuk' && styles.toggleBtnActive]}
          onPress={() => setCreateMode('yuk')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleText, createMode === 'yuk' && styles.toggleTextActive]}>
            Yük Paylaş
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, createMode === 'bos_arac' && styles.toggleBtnActive]}
          onPress={() => setCreateMode('bos_arac')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleText, createMode === 'bos_arac' && styles.toggleTextActive]}>
            Boş Araç Paylaş
          </Text>
        </TouchableOpacity>
      </View>

      {createMode === 'bos_arac' ? (
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <TextInput
            style={styles.bosAracInput}
            placeholder="Boş aracınızı tanımlayın... Örn: İstanbul'dan Ankara'ya boş tır gidiyor, yük alabilirim."
            placeholderTextColor="#9CA3AF"
            value={bosAracText}
            onChangeText={setBosAracText}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.paylasButton, isSubmitting && styles.paylasButtonDisabled]}
            onPress={handlePublishBosArac}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.paylasButtonText}>Paylaş</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      ) : (
        <>
          <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
          <KeyboardAvoidingView
            style={styles.content}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {renderStep()}
          </KeyboardAvoidingView>
        </>
      )}
      </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  geriButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 4,
    marginLeft: -4,
    gap: 4,
  },
  geriText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSpacer: {
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: PRIMARY,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  bosAracInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 160,
    maxHeight: 280,
  },
  paylasButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  paylasButtonDisabled: {
    opacity: 0.7,
  },
  paylasButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  redirectOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
});
