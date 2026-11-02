import type { SendMessageInput, UploadedFile } from './types';

export interface ChatPhoto {
  uri: string;
  name: string;
  mimeType: string;
}

/** Keep the uploaded attachment for retries, and coalesce rapid taps into one send. */
export function createPhotoSendSession(
  photo: ChatPhoto,
  dependencies: {
    upload: (uri: string, name: string, mimeType: string, signal?: AbortSignal) => Promise<UploadedFile>;
    send: (message: Omit<SendMessageInput, 'chatId'>) => Promise<unknown>;
    canSend: () => boolean;
  },
) {
  let attachment: UploadedFile | undefined;
  let inFlight: Promise<void> | undefined;
  let sent = false;
  let cancelled = false;
  const controller = new AbortController();

  return {
    cancel() { cancelled = true; controller.abort(); },
    send(): Promise<void> {
      if (inFlight) return inFlight;
      if (sent) return Promise.resolve();
      const attempt = async () => {
        if (cancelled || !dependencies.canSend()) throw new Error('Messaging is unavailable. Return to the chat and try again.');
        attachment ??= await dependencies.upload(photo.uri, photo.name, photo.mimeType, controller.signal);
        // Access or account state may have changed while the upload was running.
        if (cancelled || !dependencies.canSend()) throw new Error('Messaging is unavailable. Return to the chat and try again.');
        await dependencies.send({
          clientMessageId: attachment.url,
          content: attachment.name,
          messageType: attachment.type,
          attachmentUrl: attachment.url,
          attachmentName: attachment.name,
          attachmentSize: attachment.size,
        });
        sent = true;
      };
      inFlight = attempt().finally(() => { inFlight = undefined; });
      return inFlight;
    },
  };
}

/** SDK 57's native fetch requires a byte-readable File/Blob, not a legacy URI object. */
export async function createChatUploadBody(
  photo: ChatPhoto,
  platform: string,
  nativeFile: (uri: string) => Promise<Blob> = async uri => {
    const { File } = await import('expo-file-system');
    return new File(uri);
  },
): Promise<FormData> {
  const formData = new FormData();
  if (platform === 'web') {
    const response = await fetch(photo.uri);
    if (!response.ok) throw new Error('Could not read the selected photo. Please choose it again.');
    formData.append('file', await response.blob(), photo.name);
  } else {
    const uri = /^(file:|content:)/.test(photo.uri) ? photo.uri : `file://${photo.uri}`;
    formData.append('file', await nativeFile(uri));
  }
  return formData;
}
