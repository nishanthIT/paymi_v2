import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { secureStorage } from '@/utils/secureStorage';

import { certificateImageUrl, type ShopCertificate } from './api';

const MIME_BY_EXT: Record<string, { mime: string; uti: string }> = {
  jpg: { mime: 'image/jpeg', uti: 'public.jpeg' },
  jpeg: { mime: 'image/jpeg', uti: 'public.jpeg' },
  png: { mime: 'image/png', uti: 'public.png' },
  webp: { mime: 'image/webp', uti: 'org.webmproject.webp' },
  heic: { mime: 'image/heic', uti: 'public.heic' },
};

function fileNameFor(certificate: ShopCertificate): string {
  const name = certificate.imageFileName ?? `certificate-${certificate.id.slice(0, 8)}.jpg`;
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function fileTypeFor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? MIME_BY_EXT.jpg;
}

function downloadError(error: unknown): Error {
  const message = String((error as any)?.message ?? '');
  if (/\b404\b/.test(message)) return new Error('The certificate file is missing on the server.');
  if (/\b40[13]\b/.test(message)) return new Error('You are not allowed to download this certificate.');
  return new Error('Download failed. Check your connection and try again.');
}

/** Downloads the authenticated certificate image into the app cache. */
async function downloadToCache(certificate: ShopCertificate): Promise<File> {
  const token = await secureStorage.getToken();
  if (!token) throw new Error('Please sign in again to download this certificate.');

  const directory = new Directory(Paths.cache, 'certificates');
  directory.create({ idempotent: true, intermediates: true });
  const target = new File(directory, fileNameFor(certificate));

  try {
    const file = await File.downloadFileAsync(certificateImageUrl(certificate), target, {
      headers: { Authorization: `Bearer ${token}` },
      idempotent: true,
    });
    if (!file.exists || !file.size) throw new Error('404 empty file');
    return file;
  } catch (error) {
    throw downloadError(error);
  }
}

/** Opens the native share sheet (Save Image / Save to Files / Drive, etc.). */
export async function shareCertificate(certificate: ShopCertificate): Promise<void> {
  const file = await downloadToCache(certificate);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  const { mime, uti } = fileTypeFor(file.name);
  await Sharing.shareAsync(file.uri, {
    mimeType: mime,
    UTI: uti,
    dialogTitle: 'Save certificate',
  });
}

/**
 * Android only: saves into a folder the user picks (e.g. Downloads).
 * Returns false if the user cancelled the folder picker.
 */
export async function saveCertificateToFolder(certificate: ShopCertificate): Promise<boolean> {
  if (Platform.OS !== 'android') throw new Error('Saving to a folder is only supported on Android.');
  const file = await downloadToCache(certificate);

  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch {
    return false;
  }

  try {
    const { mime } = fileTypeFor(file.name);
    const output = folder.createFile(file.name, mime);
    output.write(await file.bytes());
    return true;
  } catch {
    throw new Error('Could not save to that folder. Try another folder or use Share.');
  }
}
