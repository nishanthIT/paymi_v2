import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createEmployee,
  deleteEmployee,
  fetchEmployees,
  updateEmployee,
  type Employee,
  type EmployeeInput,
} from './api';

const EMPLOYEES_KEY = ['employees'] as const;

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
