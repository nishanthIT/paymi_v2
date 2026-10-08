import api from '@/services/api';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface TaskAssignment {
  id: string;
  employee: { id: number; name: string; email?: string };
  isStarted?: boolean;
  isCompleted: boolean;
  completedAt?: string | null;
}

export interface ShopTask {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  status: TaskStatus;
  createdBy?: { id: number; name: string } | null;
  createdAt: string;
  assignments: TaskAssignment[];
  completedCount: number;
  totalAssignments: number;
}

export interface MyTask {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  status: TaskStatus;
  createdBy?: { id: number; name: string } | null;
  createdAt: string;
  assignmentId: string;
  isStarted: boolean;
  startedAt?: string | null;
  isCompleted: boolean;
  completedAt?: string | null;
}

export interface TaskInput {
  title: string;
  description?: string;
  dueDate?: string | null;
  employeeIds: number[];
}

function apiError(error: any, fallback: string): Error {
  if (error?.silent) return error;
  return new Error(error?.response?.data?.error ?? fallback);
}

export const taskKeys = {
  all: ['tasks', 'all'] as const,
  mine: ['tasks', 'mine'] as const,
};

export async function fetchTasks(): Promise<ShopTask[]> {
  try {
    const response = await api.get('/tasks');
    return response.data?.tasks ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load tasks');
  }
}

export async function fetchMyTasks(): Promise<MyTask[]> {
  try {
    const response = await api.get('/tasks/my-tasks');
    return response.data?.tasks ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load your tasks');
  }
}

/** Shop owner: tasks assigned to one employee. */
export async function fetchEmployeeTasks(employeeId: number): Promise<ShopTask[]> {
  try {
    const response = await api.get('/tasks', { params: { employeeId } });
    return response.data?.tasks ?? [];
  } catch (error: any) {
    throw apiError(error, 'Could not load tasks');
  }
}

export async function createTask(input: TaskInput): Promise<void> {
  try {
    await api.post('/tasks', input);
  } catch (error: any) {
    throw apiError(error, 'Could not create the task');
  }
}

export async function updateTask(id: string, input: Partial<TaskInput>): Promise<void> {
  try {
    await api.put(`/tasks/${id}`, input);
  } catch (error: any) {
    throw apiError(error, 'Could not update the task');
  }
}

export async function deleteTask(id: string): Promise<void> {
  try {
    await api.delete(`/tasks/${id}`);
  } catch (error: any) {
    throw apiError(error, 'Could not delete the task');
  }
}

export async function startTask(assignmentId: string, isStarted = true): Promise<void> {
  try {
    await api.put(`/tasks/start/${assignmentId}`, { isStarted });
  } catch (error: any) {
    throw apiError(error, 'Could not start the task');
  }
}

export async function completeTask(
  assignmentId: string,
  isCompleted = true,
): Promise<{ alreadyCompleted: boolean; completedAt: string | null }> {
  try {
    const response = await api.put(`/tasks/complete/${assignmentId}`, { isCompleted });
    return {
      alreadyCompleted: response.data?.alreadyCompleted === true,
      completedAt: response.data?.assignment?.completedAt ?? null,
    };
  } catch (error: any) {
    throw apiError(error, 'Could not complete the task');
  }
}
