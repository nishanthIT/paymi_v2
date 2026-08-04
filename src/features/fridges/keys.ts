export const fridgeKeys = {
  list: ['fridges'] as const,
  todayStatus: ['fridges', 'today-status'] as const,
  allLogs: (filters: Record<string, string | number | undefined>) =>
    ['fridges', 'all-logs', filters] as const,
};
