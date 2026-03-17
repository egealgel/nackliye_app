import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const APP_SETTINGS_CACHE_KEY = 'app_settings_cache_v1';
const APP_SETTINGS_CACHE_TS_KEY = 'app_settings_cache_ts_v1';
const APP_SETTINGS_REFRESH_MS = 30 * 60 * 1000;

type AppSettingsMap = Record<string, string>;

let appSettingsCache: AppSettingsMap | null = null;
let lastRefreshMs: number | null = null;

const DEFAULT_TEMPLATES: AppSettingsMap = {
  notification_new_message: '{sender_name}: {preview}',
  notification_job_assigned: '{from} → {to} işi size verildi.',
  notification_delivered: '{from} → {to} işi teslim edildi.',
};

function safeNumber(n: unknown): number | null {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : null;
}

function applyTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => variables[key] ?? `{${key}}`);
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        sound: 'default',
        data,
      }),
    });
  } catch {
    // Silent fail (do not crash app if push fails)
  }
}

export async function refreshAppSettingsCache(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key,value');

    if (error || !data) return;

    const map: AppSettingsMap = {};
    for (const row of data as any[]) {
      const k = row?.key;
      const v = row?.value;
      if (typeof k === 'string' && typeof v === 'string') map[k] = v;
    }

    appSettingsCache = map;
    lastRefreshMs = Date.now();

    await AsyncStorage.multiSet([
      [APP_SETTINGS_CACHE_KEY, JSON.stringify(map)],
      [APP_SETTINGS_CACHE_TS_KEY, String(lastRefreshMs)],
    ]);
  } catch {
    // Silent fail
  }
}

export async function initAppSettingsCache(): Promise<void> {
  try {
    if (appSettingsCache) return;

    const [cachedJson, cachedTs] = await AsyncStorage.multiGet([
      APP_SETTINGS_CACHE_KEY,
      APP_SETTINGS_CACHE_TS_KEY,
    ]);

    const json = cachedJson?.[1] ?? null;
    const ts = safeNumber(cachedTs?.[1]);
    lastRefreshMs = ts;

    if (json) {
      try {
        const parsed = JSON.parse(json) as unknown;
        if (parsed && typeof parsed === 'object') {
          appSettingsCache = parsed as AppSettingsMap;
        }
      } catch {
        // ignore parse
      }
    }

    const isStale =
      !lastRefreshMs || Date.now() - lastRefreshMs > APP_SETTINGS_REFRESH_MS;

    if (!appSettingsCache || isStale) {
      await refreshAppSettingsCache();
    }
  } catch {
    // Silent fail
  }
}

export function getNotificationBody(
  templateKey: keyof typeof DEFAULT_TEMPLATES | string,
  variables: Record<string, string>
): string {
  const template =
    (appSettingsCache && typeof appSettingsCache[templateKey] === 'string'
      ? appSettingsCache[templateKey]
      : DEFAULT_TEMPLATES[templateKey] ?? '') || '';

  if (!template) {
    // Last resort fallback: concatenate variables
    return Object.values(variables).filter(Boolean).join(' ');
  }

  return applyTemplate(template, variables);
}

export async function getUserExpoPushToken(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    const token = (data as any)?.expo_push_token;
    return typeof token === 'string' && token.trim() ? token : null;
  } catch {
    return null;
  }
}

