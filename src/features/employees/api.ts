import api from '@/services/api';

export interface EmployeeList {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  productCount: number;
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  phoneNo?: string | null;
  shopId: string;
  createdAt: string;
  listCount: number;
  lists: EmployeeList[];
}

export interface EmployeeInput {
  name: string;
  email: string;
  password?: string;
  phoneNo?: string;
}

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  const message = error?.response?.data?.error ?? error?.response?.data?.message ?? fallback;
  return new Error(message);
}

/** Shop-owner only: employees created by this account. */
export async function fetchEmployees(): Promise<Employee[]> {
  try {
    const response = await api.get('/employees');
    return response.data?.employees ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load employees');
  }
}

export async function createEmployee(input: EmployeeInput): Promise<void> {
  try {
    await api.post('/employees', input);
  } catch (error: any) {
    throw apiError(error, 'Could not create the employee');
  }
}

export async function updateEmployee(id: number, input: Partial<EmployeeInput>): Promise<void> {
  try {
    await api.put(`/employees/${id}`, input);
  } catch (error: any) {
    throw apiError(error, 'Could not update the employee');
  }
}

export async function deleteEmployee(id: number): Promise<void> {
  try {
    await api.delete(`/employees/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the employee');
  }
}
