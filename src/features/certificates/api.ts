import api from '@/services/api';

export type CertificateType = 'INSPECTION' | 'INSURANCE' | 'ELECTRIC' | 'HYGIENE';
export type CertificateStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';

export interface ShopCertificate {
  id: string;
  type: CertificateType;
  issuedDate?: string | null;
  expiryDate?: string | null;
  renewalDate?: string | null;
  premiumAmount?: string | number | null;
  companyDetails?: string | null;
  unitRate?: string | number | null;
  readingValueDay?: string | number | null;
  readingValueNight?: string | number | null;
  readingDateDay?: string | null;
  readingDateNight?: string | null;
  contractRenewalDate?: string | null;
  reminderDays: number;
  status: CertificateStatus;
  expiringSoon: boolean;
  expired: boolean;
  relevantDate?: string | null;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateInput {
  type: CertificateType;
  reminderDays: number;
  imageUri?: string | null; // required on create
  issuedDate?: string;
  expiryDate?: string;
  renewalDate?: string;
  premiumAmount?: string;
  companyDetails?: string;
  unitRate?: string;
  readingValueDay?: string;
  readingValueNight?: string;
  readingDateDay?: string;
  readingDateNight?: string;
  contractRenewalDate?: string;
}

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error ?? fallback);
}

export const certificateKeys = {
  list: (type: string) => ['certificates', 'list', type] as const,
  alerts: ['certificates', 'alerts'] as const,
};

export async function fetchCertificates(type?: CertificateType): Promise<ShopCertificate[]> {
  try {
    const response = await api.get('/certificates', {
      params: { type: type || undefined, sort: 'RELEVANT_DATE' },
    });
    return response.data?.certificates ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load certificates');
  }
}

export async function fetchCertificateAlerts(): Promise<ShopCertificate[]> {
  try {
    const response = await api.get('/certificates/alerts');
    return response.data?.alerts ?? [];
  } catch {
    return [];
  }
}

function buildForm(input: CertificateInput): FormData {
  const form = new FormData();
  form.append('type', input.type);
  form.append('reminderDays', String(input.reminderDays));
  const optional: (keyof CertificateInput)[] = [
    'issuedDate',
    'expiryDate',
    'renewalDate',
    'premiumAmount',
    'companyDetails',
    'unitRate',
    'readingValueDay',
    'readingValueNight',
    'readingDateDay',
    'readingDateNight',
    'contractRenewalDate',
  ];
  for (const field of optional) {
    const value = input[field];
    if (value !== undefined && value !== null && value !== '') form.append(field, String(value));
  }
  if (input.imageUri) {
    const name = input.imageUri.split('/').pop() ?? 'certificate.jpg';
    const ext = name.includes('.') ? name.split('.').pop() : 'jpg';
    form.append('image', {
      uri: input.imageUri,
      name,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    } as any);
  }
  return form;
}

export async function createCertificate(input: CertificateInput): Promise<void> {
  try {
    await api.post('/certificates', buildForm(input), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  } catch (error: any) {
    throw apiError(error, 'Could not save the certificate');
  }
}

export async function updateCertificate(id: string, input: CertificateInput): Promise<void> {
  try {
    await api.put(`/certificates/${id}`, buildForm(input), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  } catch (error: any) {
    throw apiError(error, 'Could not update the certificate');
  }
}

export async function deleteCertificate(id: string): Promise<void> {
  try {
    await api.delete(`/certificates/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the certificate');
  }
}
