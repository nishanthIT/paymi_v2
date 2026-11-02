export type ChatType = 'GROUP' | 'PERSONAL';
export type MessageType = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'LIST_SHARE';
export type ChatUserType = 'CUSTOMER' | 'EMPLOYEE' | 'ADMIN';

export interface ChatParticipant {
  id: number | string;
  name: string;
  email?: string;
  userType: ChatUserType;
  isAdmin?: boolean;
}

export interface ChatSummary {
  /** A newly created room can open without a second history request. */
  initialPage?: ChatThreadPage;
  shopId: string | null;
  isTeamChat: boolean;
  isGlobalChat?: boolean;
  isCommunityChat?: boolean;
  id: string;
  name: string;
  type: ChatType;
  lastMessage?: string | null;
  lastMessageTime?: string | null;
  lastActivityAt?: string | null;
  createdAt?: string;
  unreadCount: number;
  participants: ChatParticipant[];
  otherParticipants: ChatParticipant[];
  participantCount: number;
}

export interface ReadReceipt {
  userId: number;
  userType: ChatUserType;
  readAt: string;
}

export interface DeliveryReceipt {
  userId: number;
  userType: ChatUserType;
  deliveredAt: string;
}

export interface MessageReceiptEvent {
  chatId: string;
  messageIds: string[];
  userId: number;
  userType: ChatUserType;
  readAt?: string;
  deliveredAt?: string;
}

export interface ChatMessage {
  id: string;
  clientMessageId?: string | null;
  chatId?: string;
  content: string;
  senderId: number;
  senderName: string;
  senderType: ChatUserType;
  messageType: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  sharedListId?: string | null;
  sharedList?: { id: string; name: string; itemCount?: number } | null;
  timestamp: string;
  isOwnMessage: boolean;
  readBy?: ReadReceipt[];
  deliveredTo?: DeliveryReceipt[];
  /** Client-only optimistic states. */
  pending?: boolean;
  failed?: boolean;
}

export interface ChatThreadPage {
  isGlobalChat?: boolean;
  id: string;
  name: string;
  type: ChatType;
  participants: ChatParticipant[];
  participantCount: number;
  messages: ChatMessage[];
  pagination?: { hasMore: boolean; nextCursor: string | null; limit: number };
}

export interface DirectoryUser {
  id: string;
  name: string;
  phone: string;
  userType: ChatUserType;
}

export interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: 'IMAGE' | 'DOCUMENT';
  mimetype: string;
}

export interface SendMessageInput {
  chatId: string;
  clientMessageId?: string;
  content: string;
  messageType?: MessageType;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
}
