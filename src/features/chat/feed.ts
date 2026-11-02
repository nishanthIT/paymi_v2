import { conversationActivity } from './dates';
import type { ChatSummary } from './types';

export type ChatSection = 'all' | 'team' | 'direct' | 'unread';

/** Shared retail conversations coexist with private selected-shop teams. */
export function selectChatFeed(chats: ChatSummary[], shopId: string | undefined, section: ChatSection) {
  if (!shopId) return [];
  return chats.filter(chat => (chat.shopId === shopId || chat.isCommunityChat) && (
    section === 'all' ||
    (section === 'team' && chat.isTeamChat) ||
    (section === 'direct' && chat.type === 'PERSONAL') ||
    (section === 'unread' && chat.unreadCount > 0)
  )).sort((a, b) => Number(!!b.isGlobalChat) - Number(!!a.isGlobalChat) || conversationActivity(b) - conversationActivity(a));
}
