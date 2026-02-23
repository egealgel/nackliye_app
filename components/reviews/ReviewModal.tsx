import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/services/supabase';

const PRIMARY = '#2563EB';
const STAR_SIZE = 44;

function formatNameForQuestion(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 0) return 'Kullanıcı';
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  loadId: string;
  reviewedId: string;
  reviewedName: string;
};

export default function ReviewModal({
  visible,
  onClose,
  onSuccess,
  loadId,
  reviewedId,
  reviewedName,
}: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      Alert.alert('Uyarı', 'Lütfen 1 ile 5 arasında puan verin.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        Alert.alert('Hata', 'Oturum bulunamadı.');
        return;
      }

      const { error } = await supabase.from('reviews').insert({
        reviewer_id: session.user.id,
        reviewed_id: reviewedId,
        load_id: loadId,
        rating,
        comment: comment.trim() || null,
      });

      if (error) {
        throw error;
      }

      onSuccess?.();
      onClose();
      setRating(0);
      setComment('');
      Alert.alert('Puanınız kaydedildi!', '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Puan kaydedilemedi.';
      Alert.alert('Hata', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setRating(0);
      setComment('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.modal}>
          <Text style={styles.title}>
            {formatNameForQuestion(reviewedName || 'Kullanıcı')} nasıldı?
          </Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setRating(s)}
                style={styles.starBtn}
                disabled={submitting}
              >
                <Ionicons
                  name={rating >= s ? 'star' : 'star-outline'}
                  size={STAR_SIZE}
                  color={rating >= s ? PRIMARY : '#9CA3AF'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Deneyiminizi paylaşın..."
            placeholderTextColor="#9CA3AF"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            editable={!submitting}
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Puanla</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={handleClose}
            disabled={submitting}
          >
            <Text style={styles.dismissText}>Daha Sonra</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  starBtn: {
    padding: 4,
    minWidth: STAR_SIZE + 8,
    minHeight: STAR_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dismissBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 16,
    color: '#6B7280',
  },
});
