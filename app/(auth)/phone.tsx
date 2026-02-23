import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhone(text));
  };

  const rawPhone = phone.replace(/\s/g, '');

  const handleSendOtp = async () => {
    if (rawPhone.length !== 10) {
      Alert.alert('Hata', 'Lütfen 10 haneli telefon numaranızı girin.');
      return;
    }

    setLoading(true);
    const fullPhone = `+90${rawPhone}`;

    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });

    setLoading(false);

    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }

    router.push({ pathname: '/(auth)/verify', params: { phone: rawPhone } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>🚛</Text>
        <Text style={styles.title}>yüküstü</Text>
        <Text style={styles.subtitle}>Telefon numaranızla giriş yapın</Text>

        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <Text style={styles.countryFlag}>🇹🇷</Text>
            <Text style={styles.countryCodeText}>+90</Text>
          </View>
          <TextInput
            ref={inputRef}
            style={styles.phoneInput}
            placeholder="5XX XXX XXXX"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={handlePhoneChange}
            maxLength={12}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.button, rawPhone.length !== 10 && styles.buttonDisabled]}
          onPress={handleSendOtp}
          disabled={loading || rawPhone.length !== 10}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Başla</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  icon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginBottom: 40,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    gap: 8,
  },
  countryFlag: {
    fontSize: 24,
  },
  countryCodeText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  phoneInput: {
    flex: 1,
    height: 56,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '500',
    color: '#1A1A1A',
    letterSpacing: 1,
  },
  button: {
    height: 56,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
});
