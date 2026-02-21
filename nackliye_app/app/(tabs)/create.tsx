import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/services/supabase';
import { LoadFormData, VehicleType, suggestVehicleType } from '@/types/load';
import ProgressBar from '@/components/create-load/ProgressBar';
import CityDistrictPicker from '@/components/create-load/CityDistrictPicker';
import StepWeight from '@/components/create-load/StepWeight';
import StepDimensions from '@/components/create-load/StepDimensions';
import StepVehicle from '@/components/create-load/StepVehicle';
import StepPhotos from '@/components/create-load/StepPhotos';
import StepDescription from '@/components/create-load/StepDescription';
import StepReview from '@/components/create-load/StepReview';

const TOTAL_STEPS = 8;
const PRIMARY = '#FF6B35';

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

export default function CreateLoadScreen() {
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<LoadFormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, TOTAL_STEPS)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  const updateForm = useCallback((updates: Partial<LoadFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handlePublish = async () => {
    if (!session?.user?.id) {
      Alert.alert('Hata', 'Lütfen giriş yapın.');
      return;
    }

    setIsSubmitting(true);
    try {
      const photoUrls: string[] = [];

      for (const photoUri of formData.photos) {
        const ext = photoUri.split('.').pop() || 'jpg';
        const fileName = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const response = await fetch(photoUri);
        const blob = await response.blob();

        const arrayBuffer = await new Response(blob).arrayBuffer();

        const { data, error } = await supabase.storage
          .from('load-photos')
          .upload(fileName, arrayBuffer, {
            contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('load-photos')
          .getPublicUrl(data.path);

        photoUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase.from('loads').insert({
        user_id: session.user.id,
        from_city: formData.fromCity,
        from_district: formData.fromDistrict,
        to_city: formData.toCity,
        to_district: formData.toDistrict,
        weight: formData.weight,
        width: formData.width || null,
        length: formData.length || null,
        height: formData.height || null,
        vehicle_type: formData.vehicleType,
        photos: photoUrls,
        description: formData.description || null,
        status: 'active',
      });

      if (error) throw error;

      Alert.alert('Başarılı!', 'Yük ilanınız yayınlandı.', [
        {
          text: 'Tamam',
          onPress: () => {
            setStep(1);
            setFormData(INITIAL_FORM);
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <CityDistrictPicker
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
              updateForm({ vehicleType: suggestVehicleType(formData.weight) });
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
            onPhotosChange={(photos) => updateForm({ photos })}
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {step > 1 ? (
          <TouchableOpacity
            onPress={goBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <FontAwesome name="arrow-left" size={20} color="#1F2937" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Text style={styles.headerTitle}>Yük Oluştur</Text>
        <View style={styles.backPlaceholder} />
      </View>

      <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        {renderStep()}
      </KeyboardAvoidingView>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});
