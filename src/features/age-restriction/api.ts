import { Platform } from 'react-native';

import api from '@/services/api';

export interface AgeRestrictionRecord {
  id: string;
  occurredAt: string;
  description: string;
  imageUrl: string | null;
  createdByName: string | null;
  updatedByName: string | null;
  canManage: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgeRestrictionInput {
  occurredAt: Date;
  description: string;
  /** New local image to upload. */
  imageUri?: string | null;
  /** Clear the existing image (edit only). */
  removeImage?: boolean;
}

export const AGE_RESTRICTION_DESCRIPTION_MAX = 500;

export const ageRestrictionKeys = {
  all: ['age-restriction-records'] as const,
  list: (filters: { from?: string }) => ['age-restriction-records', filters] as const,
};

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error ?? fallback);
}

export async function fetchAgeRestrictionRecords(params: {
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
}): Promise<AgeRestrictionRecord[]> {
  try {
    const response = await api.get('/age-restriction-records', { params });
    return response.data?.records ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load age restriction records');
  }
}

async function buildForm(input: AgeRestrictionInput): Promise<FormData> {
  const form = new FormData();
  form.append('occurredAt', input.occurredAt.toISOString());
  form.append('description', input.description);
  if (input.imageUri) {
    if (Platform.OS === 'web') {
      const blob = await (await fetch(input.imageUri)).blob();
      const ext = blob.type.split('/')[1] ?? 'jpeg';
      form.append('image', blob, `age-restriction.${ext}`);
    } else {
      const name = input.imageUri.split('/').pop() ?? 'age-restriction.jpg';
      const ext = (name.includes('.') ? name.split('.').pop() : 'jpg')!.toLowerCase();
      form.append('image', {
        uri: input.imageUri,
        name,
        type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      } as any);
    }
  } else if (input.removeImage) {
    form.append('removeImage', 'true');
  }
  return form;
}

export async function createAgeRestrictionRecord(input: AgeRestrictionInput): Promise<AgeRestrictionRecord> {
  try {
    const response = await api.post('/age-restriction-records', await buildForm(input), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.record;
  } catch (error: any) {
    throw apiError(error, 'Could not save the record');
  }
}

export async function updateAgeRestrictionRecord(
  id: string,
  input: AgeRestrictionInput,
): Promise<AgeRestrictionRecord> {
  try {
    const response = await api.put(`/age-restriction-records/${id}`, await buildForm(input), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.record;
  } catch (error: any) {
    throw apiError(error, 'Could not update the record');
  }
}

export async function deleteAgeRestrictionRecord(id: string): Promise<void> {
  try {
    await api.delete(`/age-restriction-records/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the record');
  }
}
