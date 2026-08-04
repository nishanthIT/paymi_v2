export const chatKeys = {
  all: ['chats'] as const,
  thread: (chatId: string) => ['chat', chatId] as const,
  users: (search: string) => ['chat-users', search] as const,
};
