import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { fetchEmployeeTasks } from '@/features/tasks/api';

import {
  createEmployee,
  deleteEmployee,
  fetchEmployeeLists,
  fetchEmployees,
  setEmployeeStatus,
  updateEmployee,
  type Employee,
  type EmployeeInput,
} from './api';

const EMPLOYEES_KEY = ['employees'] as const;
// Under ['lists'] so list socket events and list mutations refresh it too.
export const employeeListsKey = (id: number) => ['lists', 'employee', id] as const;

/** Only the shop owner manages shop employees. The API enforces the same rule. */
export function useCanManageShopEmployees(): boolean {
  const { user } = useAuth();
  return user?.userType === 'CUSTOMER';
}

export function useEmployeeLists(id: number) {
  return useQuery({
    queryKey: employeeListsKey(id),
    queryFn: () => fetchEmployeeLists(id),
    enabled: Number.isInteger(id),
  });
}

export function useEmployeeTasks(id: number) {
  return useQuery({
    queryKey: ['tasks', 'employee', id],
    queryFn: () => fetchEmployeeTasks(id),
    enabled: Number.isInteger(id),
  });
}

export function useSetEmployeeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'ACTIVE' | 'INACTIVE' }) => setEmployeeStatus(id, status),
    onSettled: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

export function useEmployees(enabled = true) {
  return useQuery({
    queryKey: EMPLOYEES_KEY,
    queryFn: fetchEmployees,
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeInput) => createEmployee(input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<EmployeeInput> }) =>
      updateEmployee(id, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEmployee(id),
    // Optimistically remove the card.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: EMPLOYEES_KEY });
      const previous = queryClient.getQueryData<Employee[]>(EMPLOYEES_KEY);
      queryClient.setQueryData<Employee[]>(EMPLOYEES_KEY, (old) =>
        (old ?? []).filter((e) => e.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(EMPLOYEES_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  });
}
