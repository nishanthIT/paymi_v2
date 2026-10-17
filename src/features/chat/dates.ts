/** Local calendar days, including midnight/year/DST boundaries. */
export function formatConversationDate(timestamp?: string | null, now = new Date()) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function conversationActivity(chat: { lastMessageTime?: string | null; lastActivityAt?: string | null; createdAt?: string }) {
  const value = new Date(chat.lastMessageTime ?? chat.lastActivityAt ?? chat.createdAt ?? 0).getTime();
  return Number.isNaN(value) ? 0 : value;
}
