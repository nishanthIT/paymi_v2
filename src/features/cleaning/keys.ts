export const cleaningKeys = {
  areas: ['cleaning', 'areas'] as const,
  today: ['cleaning', 'today'] as const,
  history: (filters: Record<string, string | undefined>) =>
    ['cleaning', 'history', filters] as const,
};
