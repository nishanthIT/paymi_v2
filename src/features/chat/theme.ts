/** Shared chat surfaces: warm white with restrained PayMi gold. */
export const ChatColors = {
  canvas: '#FCFAF4',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F1E7',
  border: '#ECE7DA',
  text: '#292821',
  textSecondary: '#68675E',
  muted: '#706D63',
  gold: '#836113',
  goldSoft: '#F6EBCB',
  outgoing: '#F4E7BC',
  incoming: '#FFFFFF',
  danger: '#B54B3A',
  skeleton: '#EEEAE0',
  success: '#53715B',
} as const;

export function chatInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => Array.from(part)[0]).join('').toLocaleUpperCase() || '?';
}
