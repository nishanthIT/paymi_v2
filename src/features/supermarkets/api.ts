import api from '@/services/api';
export interface Supermarket {
  id: string; name: string; address: string; role: 'OWNER' | 'EMPLOYEE';
  isDefault: boolean; employeeCount?: number; permissions: string[];
}
export interface SupermarketDirectory {
  supermarkets: Supermarket[]; defaultSupermarketId: string | null;
  canCreateAdditional: boolean; canSwitchOperationalContext: boolean;
}
// Directory is account-wide, including when the previously selected membership has been revoked.
export async function getSupermarkets(): Promise<SupermarketDirectory> {
  return (await api.get('/shop/supermarkets', { headers: { 'X-Supermarket-Id': null } })).data;
}
export async function createSupermarket(input: { name: string; address?: string; requestKey: string }) {
  return (await api.post<{ shop: { id: string; name: string }; replayed: boolean }>('/shop/supermarkets',
    { name: input.name, address: input.address || '' }, { headers: { 'Idempotency-Key': input.requestKey } })).data;
}
export async function setDefaultSupermarket(id: string) {
  await api.put(`/shop/supermarkets/${encodeURIComponent(id)}/default`);
}
