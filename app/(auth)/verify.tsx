import { useState, useRef, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/services/supabase';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const { phone: rawPhone } = useLocalSearchParams<{ phone: string }>();
  const fullPhone = `+90${rawPhone}`;
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '');
    if (!digit && text !== '') return;

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }

    if (digit && index === CODE_LENGTH - 1) {
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH) {
        verifyOtp(fullCode);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
      inputs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (otp: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otp,
      type: 'sms',
    });
    setLoading(false);

    if (error) {
      Alert.alert('Hata', error.message);
      setCode(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
      return;
    }

    if (data.session) {
      router.replace('/');
    }
  };

  const handleResend = async () => {
    setResendTimer(60);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    if (error) {
      Alert.alert('Hata', error.message);
    }
  };

  const fullCode = code.join('');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Doğrulama Kodu</Text>
        <Text style={styles.subtitle}>
          <Text style={styles.phoneHighlight}>{fullPhone}</Text> numarasına{'\n'}
          gönderilen 6 haneli kodu girin
        </Text>

        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputs.current[i] = ref; }}
              style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              selectTextOnFocus
            />
          ))}
        </View>

        {loading && (
          <ActivityIndicator
            color="#2563EB"
            size="large"
            style={{ marginTop: 24 }}
          />
        )}

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resendTimer > 0}
        >
          <Text
            style={[
              styles.resendText,
              resendTimer > 0 && styles.resendTextDisabled,
            ]}
          >
            {resendTimer > 0
              ? `Tekrar gönder (${resendTimer}s)`
              : 'Kodu tekrar gönder'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.verifyButton, fullCode.length !== CODE_LENGTH && styles.verifyButtonDisabled]}
          onPress={() => verifyOtp(fullCode)}
          disabled={loading || fullCode.length !== CODE_LENGTH}
          activeOpacity={0.8}
        >
          <Text style={styles.verifyButtonText}>Doğrula</Text>
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
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    padding: 8,
  },
  backText: {
    fontSize: 18,
    color: '#2563EB',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
    marginBottom: 32,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: '#1A1A1A',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  codeInput: {
    width: 48,
    height: 56,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#F5F5F5',
  },
  codeInputFilled: {
    borderColor: '#2563EB',
    backgroundColor: '#FFF5F0',
  },
  resendButton: {
    marginTop: 24,
    alignSelf: 'center',
    padding: 8,
  },
  resendText: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: '#999',
  },
  verifyButton: {
    height: 56,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
});
