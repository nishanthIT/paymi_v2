/** Send local calendar-day boundaries as instants, avoiding UTC day shifts. */
export function payoutDateBoundary(date: Date, end = false): string {
  const boundary = new Date(date);
  if (end) boundary.setHours(23, 59, 59, 999);
  else boundary.setHours(0, 0, 0, 0);
  return boundary.toISOString();
}
