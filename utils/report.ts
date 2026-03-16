import { Alert, ActionSheetIOS, Platform } from 'react-native';
import { supabase } from '@/services/supabase';

export const REPORT_REASONS = [
  'Spam / Sahte İlan',
  'Uygunsuz İçerik',
  'Dolandırıcılık Şüphesi',
  'Diğer',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

type BaseReportPayload = {
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
};

type LoadReportPayload = BaseReportPayload & {
  loadId: string;
};

type MessageReportPayload = BaseReportPayload & {
  messageId: string;
};

async function hasExistingReport(
  where: Record<string, string>
): Promise<boolean> {
  const { count } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .match(where);
  return (count ?? 0) > 0;
}

export async function submitLoadReport({
  reporterId,
  reportedUserId,
  loadId,
  reason,
}: LoadReportPayload) {
  if (!reporterId || !reportedUserId || !loadId) return;
  if (reporterId === reportedUserId) {
    Alert.alert('Bilgi', 'Kendi ilanınızı ihbar edemezsiniz.');
    return;
  }

  const duplicate = await hasExistingReport({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    load_id: loadId,
  });
  if (duplicate) {
    Alert.alert('Bilgi', 'Bu içerik zaten ihbar edildi.');
    return;
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    load_id: loadId,
    reason,
  });

  if (error) {
    Alert.alert('Hata', error.message || 'İhbar gönderilirken bir hata oluştu.');
    return;
  }

  Alert.alert('Teşekkürler', 'İhbar edildi, incelenecektir.');
}

export async function submitMessageReport({
  reporterId,
  reportedUserId,
  messageId,
  reason,
}: MessageReportPayload) {
  if (!reporterId || !reportedUserId || !messageId) return;
  if (reporterId === reportedUserId) {
    Alert.alert('Bilgi', 'Kendi mesajınızı ihbar edemezsiniz.');
    return;
  }

  const duplicate = await hasExistingReport({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    message_id: messageId,
  });
  if (duplicate) {
    Alert.alert('Bilgi', 'Bu içerik zaten ihbar edildi.');
    return;
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    message_id: messageId,
    reason,
  });

  if (error) {
    Alert.alert('Hata', error.message || 'İhbar gönderilirken bir hata oluştu.');
    return;
  }

  Alert.alert('Teşekkürler', 'İhbar edildi, incelenecektir.');
}

export async function pickReportReason(): Promise<ReportReason | null> {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'İhbar Nedeni',
          options: [...REPORT_REASONS, 'İptal'],
          cancelButtonIndex: REPORT_REASONS.length,
        },
        (buttonIndex) => {
          if (buttonIndex === REPORT_REASONS.length) {
            resolve(null);
          } else {
            resolve(REPORT_REASONS[buttonIndex] as ReportReason);
          }
        }
      );
    });
  }

  return new Promise((resolve) => {
    Alert.alert(
      'İhbar Nedeni',
      undefined,
      [
        ...REPORT_REASONS.map((r) => ({
          text: r,
          onPress: () => resolve(r),
        })),
        {
          text: 'İptal',
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ],
      { cancelable: true }
    );
  });
}

