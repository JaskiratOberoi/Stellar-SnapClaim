import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { api } from './api';
import type { Receipt } from './types';

export type Picked = { base64: string; contentType: string };

/** Photograph a receipt (phones only; the browser falls back to the file chooser). */
export async function snapWithCamera(): Promise<Picked | null> {
  if (Platform.OS === 'web') return pickFile();
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera permission is needed to snap a receipt');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, exif: false });
  return fromImageResult(result);
}

export async function pickFromLibrary(): Promise<Picked | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, exif: false, allowsMultipleSelection: false });
  return fromImageResult(result);
}

/** Any image or PDF file, e.g. an emailed invoice. */
export async function pickFile(): Promise<Picked | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const contentType = asset.mimeType ?? (asset.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  if (Platform.OS === 'web') {
    const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
    return { base64: await blobToBase64(blob), contentType };
  }
  const base64 = await new File(asset.uri).base64();
  return { base64, contentType };
}

function fromImageResult(result: ImagePicker.ImagePickerResult): Picked | null {
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  if (!asset.base64) throw new Error('Could not read the image');
  const fromDataUrl = /^data:([^;]+);base64,/.exec(asset.uri)?.[1];
  const contentType = asset.mimeType ?? fromDataUrl ?? 'image/jpeg';
  return { base64: asset.base64.replace(/^data:[^,]+,/, ''), contentType };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]+,/, ''));
    reader.readAsDataURL(blob);
  });
}

/** Upload and run Snap & Extract on the server. */
export function uploadReceipt(picked: Picked): Promise<Receipt> {
  return api<Receipt>('/api/v1/receipts/base64', { body: { data: picked.base64, content_type: picked.contentType } });
}
