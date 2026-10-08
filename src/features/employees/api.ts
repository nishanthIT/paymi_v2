import api from '@/services/api';

export interface EmployeeList {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  productCount: number;
}

export type MembershipStatus = 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'REMOVED';

/** A list an employee created in this shop, as the owner sees it. */
export interface EmployeeListSummary {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  itemCount: number;
  collectedCount: number;
  /** The owner already copied this list into their own lists (live, same list). */
  copiedByMe: boolean;
}

/** A Shop Employee: a membership in this shop only (never company staff). */
export interface Employee {
  id: number;
  membershipId: string;
  name: string;
  email: string;
  phoneNo?: string | null;
  shopId: string;
  permissions: string[];
  status: MembershipStatus;
  createdAt: string;
  lastActiveAt?: string | null;
  /** Login details are managed elsewhere for this account and cannot be changed from the shop. */
  credentialsLocked?: boolean;
  listCount: number;
  lists: EmployeeList[];
}

export interface EmployeeInput {
  name: string;
  email?: string;
  password?: string;
  phoneNo?: string;
  permissions?: string[];
}

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  const message = error?.response?.data?.error ?? error?.response?.data?.message ?? fallback;
  return new Error(message);
}

/** Shop owner: employees of their own shop (removed ones excluded). */
export async function fetchEmployees(): Promise<Employee[]> {
  try {
    const response = await api.get('/employees');
    return response.data?.employees ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load employees');
  }
}

export async function fetchEmployeeLists(id: number): Promise<EmployeeListSummary[]> {
  try {
    const response = await api.get(`/employees/${id}/lists`);
    return response.data?.lists ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load this employee\'s lists');
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

export async function setEmployeeStatus(id: number, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
  try {
    await api.patch(`/employees/${id}/status`, { status });
  } catch (error: any) {
    throw apiError(error, 'Could not change the employee status');
  }
}

/** Removes the person from this shop. Their account and lists are kept. */
export async function deleteEmployee(id: number): Promise<void> {
  try {
    await api.delete(`/employees/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not remove the employee');
  }
}
