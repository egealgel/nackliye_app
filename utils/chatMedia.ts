import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/services/supabase';

const BUCKET = 'chat-media';

export type DocumentMeta = {
  fileName: string;
  fileSize: number;
};

export async function pickAndUploadPhoto(
  userId: string,
  mode: 'camera' | 'gallery'
): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
  };

  const result =
    mode === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  let uri = asset.uri;

  // Ensure we handle file:// URIs consistently
  if (!uri.startsWith('file://')) {
    uri = `file://${uri}`;
  }

  // Best-effort file size logging removed in production cleanup

  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Best-effort file size logging removed in production cleanup

  const fileName = `${userId}/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}.jpg`;

  const response = await fetch(manipulated.uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const uploadPromise = supabase.storage
    .from(BUCKET)
    .upload(fileName, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  const timeoutMs = 30000;
  let timeoutId: NodeJS.Timeout | undefined;

  const timedUpload = new Promise<typeof uploadPromise extends Promise<infer T> ? T : never>(
    (resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Fotoğraf yükleme zaman aşımına uğradı (30s).'));
      }, timeoutMs);
      uploadPromise.then(resolve).catch(reject);
    }
  );

  try {
    const { data, error } = await timedUpload;

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function pickAndUploadDocument(
  userId: string
): Promise<{ url: string; meta: DocumentMeta } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const file = result.assets[0];
  const fileName = file.name;
  const fileSize = file.size ?? 0;

  const ext = fileName.split('.').pop() || 'bin';
  const storagePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const response = await fetch(file.uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const mimeType = file.mimeType ?? 'application/octet-stream';
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    meta: { fileName, fileSize },
  };
}
