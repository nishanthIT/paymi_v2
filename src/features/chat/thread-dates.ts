type DatedMessage = { timestamp?: string | null };

/** Compare local calendar dates, never elapsed 24-hour intervals or UTC slices. */
export function messageDay(timestamp?: string | null): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function formatMessageDay(timestamp?: string | null, now = new Date()): string {
  const day = messageDay(timestamp);
  if (!day || !timestamp) return '';
  if (day === messageDay(now.toISOString())) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === messageDay(yesterday.toISOString())) return 'Yesterday';
  return new Date(timestamp).toLocaleDateString([], {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** The older neighbour follows this message in the inverted, newest-first data. */
export function startsMessageDay(messages: readonly DatedMessage[], index: number): boolean {
  const day = messageDay(messages[index]?.timestamp);
  return !!day && day !== messageDay(messages[index + 1]?.timestamp);
}

export type VisibleMessage<T extends DatedMessage> = {
  item: T;
  index?: number | null;
  isViewable: boolean;
};

/** Viewability event order is not a visual-order contract. Highest index is top. */
export function topVisibleMessage<T extends DatedMessage>(tokens: readonly VisibleMessage<T>[]): T | null {
  let top: VisibleMessage<T> | null = null;
  for (const token of tokens) {
    if (!token.isViewable || token.index == null || !Number.isInteger(token.index) || token.index < 0
      || !messageDay(token.item?.timestamp)) continue;
    if (!top || token.index > top.index!) top = token;
  }
  return top?.item ?? null;
}
