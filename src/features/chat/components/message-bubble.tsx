import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

import { getAttachmentUrl } from '../api';
import type { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  /** Show sender names for group conversations. */
  isGroup: boolean;
  onLongPress: (message: ChatMessage) => void;
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** WhatsApp-style message bubble with delivery/read ticks for own messages. */
export const MessageBubble = memo(function MessageBubble({
  message,
  isGroup,
  onLongPress,
}: MessageBubbleProps) {
  const own = message.isOwnMessage;
  const attachment = getAttachmentUrl(message.attachmentUrl);
  const read = (message.readBy?.length ?? 0) > 0;

  return (
    <View style={[styles.row, own ? styles.rowOwn : styles.rowOther]}>
      <Pressable
        onLongPress={() => onLongPress(message)}
        delayLongPress={280}
        style={({ pressed }) => [
          styles.bubble,
          own ? styles.bubbleOwn : styles.bubbleOther,
          message.failed && styles.bubbleFailed,
          pressed && { opacity: 0.9 },
        ]}
      >
        {isGroup && !own && (
          <Text style={styles.senderName}>{message.senderName}</Text>
        )}

        {message.messageType === 'IMAGE' && attachment && (
          <Image source={{ uri: attachment }} style={styles.image} contentFit="cover" transition={150} />
        )}

        {message.messageType === 'DOCUMENT' && (
          <View style={styles.documentRow}>
            <View style={[styles.documentIcon, own && styles.documentIconOwn]}>
              <Ionicons
                name="document-text"
                size={20}
                color={own ? '#FFFFFF' : Colors.light.primary}
              />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text
                style={[styles.documentName, own && styles.textOwn]}
                numberOfLines={1}
              >
                {message.attachmentName ?? 'Document'}
              </Text>
              {!!message.attachmentSize && (
                <Text style={[styles.documentSize, own && styles.metaOwn]}>
                  {formatSize(message.attachmentSize)}
                </Text>
              )}
            </View>
          </View>
        )}

        {message.messageType === 'LIST_SHARE' && message.sharedList && (
          <View style={styles.listShare}>
            <Ionicons
              name="list-circle"
              size={22}
              color={own ? '#FFFFFF' : Colors.light.primary}
            />
            <View>
              <Text style={[styles.listShareName, own && styles.textOwn]}>
                {message.sharedList.name}
              </Text>
              {message.sharedList.itemCount != null && (
                <Text style={[styles.documentSize, own && styles.metaOwn]}>
                  {message.sharedList.itemCount} items
                </Text>
              )}
            </View>
          </View>
        )}

        {!!message.content &&
          !(message.messageType === 'IMAGE' && message.content === message.attachmentName) && (
            <Text style={[styles.text, own && styles.textOwn]}>{message.content}</Text>
          )}

        <View style={styles.metaRow}>
          <Text style={[styles.time, own && styles.metaOwn]}>{formatTime(message.timestamp)}</Text>
          {own && (
            <>
              {message.failed ? (
                <Ionicons name="alert-circle" size={13} color="#FFD9D3" />
              ) : message.pending ? (
                <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.75)" />
              ) : (
                <Ionicons
                  name={read ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={read ? '#8BE0FF' : 'rgba(255,255,255,0.8)'}
                />
              )}
            </>
          )}
        </View>
        {message.failed && (
          <Text style={styles.failedText}>Not sent — long-press to retry or delete</Text>
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Spacing.md,
    marginVertical: 2,
    flexDirection: 'row',
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    gap: 3,
  },
  bubbleOwn: {
    backgroundColor: Colors.light.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.light.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderBottomLeftRadius: 4,
  },
  bubbleFailed: {
    backgroundColor: Colors.light.error,
  },
  senderName: {
    ...Typography.caption,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  text: {
    ...Typography.body,
    fontSize: 15,
    color: Colors.light.text,
  },
  textOwn: {
    color: '#FFFFFF',
  },
  image: {
    width: 220,
    height: 200,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  documentIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentIconOwn: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  documentName: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.light.text,
  },
  documentSize: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  listShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  listShareName: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.light.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  time: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textLight,
  },
  metaOwn: {
    color: 'rgba(255,255,255,0.8)',
  },
  failedText: {
    ...Typography.caption,
    fontSize: 10,
    color: '#FFFFFF',
  },
});
