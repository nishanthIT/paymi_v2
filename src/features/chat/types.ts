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
  id: string;
  name: string;
  type: ChatType;
  lastMessage?: string | null;
  lastMessageTime?: string | null;
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

export interface ChatMessage {
  id: string;
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
  /** Client-only optimistic states. */
  pending?: boolean;
  failed?: boolean;
}

export interface ChatThreadPage {
  id: string;
  name: string;
  type: ChatType;
  participants: ChatParticipant[];
  participantCount: number;
  messages: ChatMessage[];
}

export interface DirectoryUser {
  id: string;
  name: string;
  /** Backend maps the user's email into this field. */
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
  content: string;
  messageType?: MessageType;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
}
