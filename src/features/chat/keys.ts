// A new namespace prevents the pre-shop directory/thread cache from being reused.
export const chatKeys = {
  all: ['shop-chats-v1'] as const,
  threads: ['shop-chat-v1'] as const,
  thread: (chatId: string) => ['shop-chat-v1', chatId] as const,
  directory: ['shop-chat-users-v1'] as const,
  users: (search: string) => ['shop-chat-users-v1', search] as const,
  searches: ['shop-chat-search-v1'] as const,
  search: (search: string) => ['shop-chat-search-v1', search] as const,
  messageSearches: ['shop-chat-message-search-v1'] as const,
  messageSearch: (chatId: string, search: string) => ['shop-chat-message-search-v1', chatId, search] as const,
};
