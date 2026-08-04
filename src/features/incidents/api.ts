import api from '@/services/api';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface IncidentLog {
  id: string;
  incidentAt: string;
  description: string;
  imageUrl?: string | null;
  severity: IncidentSeverity;
  createdByName: string;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentInput {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  description: string;
  severity: IncidentSeverity;
  imageUri?: string | null;
}

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error ?? fallback);
}

export const incidentKeys = {
  list: (filters: Record<string, string | undefined>) => ['incidents', filters] as const,
};

export async function fetchIncidents(params: {
  startDate?: string;
  endDate?: string;
  severity?: IncidentSeverity;
  q?: string;
  limit?: number;
}): Promise<IncidentLog[]> {
  try {
    const response = await api.get('/incidents', { params });
    return response.data?.logs ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load incidents');
  }
}

function buildForm(input: IncidentInput): FormData {
  const form = new FormData();
  form.append('date', input.date);
  form.append('time', input.time);
  form.append('description', input.description);
  form.append('severity', input.severity);
  if (input.imageUri) {
    const name = input.imageUri.split('/').pop() ?? 'incident.jpg';
    const ext = name.includes('.') ? name.split('.').pop() : 'jpg';
    form.append('image', {
      uri: input.imageUri,
      name,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    } as any);
  }
  return form;
}

export async function createIncident(input: IncidentInput): Promise<void> {
  try {
    await api.post('/incidents', buildForm(input), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  } catch (error: any) {
    throw apiError(error, 'Could not save the incident');
  }
}

export async function updateIncident(id: string, input: IncidentInput): Promise<void> {
  try {
    await api.put(`/incidents/${id}`, buildForm(input), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  } catch (error: any) {
    throw apiError(error, 'Could not update the incident');
  }
}

export async function deleteIncident(id: string): Promise<void> {
  try {
    await api.delete(`/incidents/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the incident');
  }
}
