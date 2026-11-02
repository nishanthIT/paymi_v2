import { Ionicons } from '@expo/vector-icons';
import { PrivateImage } from '@/components/ui/private-image';
import React, { memo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BorderRadius, Spacing, Typography } from '@/constants/theme';

import { getAttachmentUrl } from '../api';
import type { ChatMessage } from '../types';
import { ChatColors } from '../theme';

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
  const otherPerson = (receipt: { userId: number; userType: string }) => receipt.userId !== message.senderId || receipt.userType !== message.senderType;
  const read = message.readBy?.some(otherPerson) ?? false;
  const delivered = read || (message.deliveredTo?.some(otherPerson) ?? false);
  const { width } = useWindowDimensions();
  const [failedAttachment, setFailedAttachment] = useState<string | null>(null);
  const bubbleWidth = Math.min(Math.max(160, width - 64), width * 0.84, 560);
  const imageWidth = Math.min(270, bubbleWidth - 24);

  return (
    <View style={[styles.row, own ? styles.rowOwn : styles.rowOther]}>
      <View style={[
        styles.bubble,
        { maxWidth: bubbleWidth },
        own ? styles.bubbleOwn : styles.bubbleOther,
        message.failed && styles.bubbleFailed,
      ]}>
        {/* Keep independent controls as siblings: web accessibility roles render
            real buttons, which cannot contain another button. */}
        {isGroup && !own && (
          <Text accessibilityRole="button" accessibilityLabel={`Actions for ${message.senderName}`}
            onPress={() => onLongPress(message)}
            onLongPress={() => onLongPress(message)}
            style={styles.senderName}>{message.senderName}</Text>
        )}

        {message.messageType === 'IMAGE' && (!attachment || failedAttachment === attachment) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={attachment ? 'Retry loading photo' : 'Photo unavailable'}
            disabled={!attachment}
            onPress={() => setFailedAttachment(null)}
            onLongPress={() => onLongPress(message)}
            delayLongPress={280}
            style={[styles.imageFallback, { width: imageWidth }]}
          >
            <Ionicons name="image-outline" size={26} color={ChatColors.textSecondary} />
            <Text style={styles.documentSize}>Photo unavailable</Text>
            {!!attachment && <Text style={styles.retryPhoto}>Tap to retry</Text>}
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${message.senderName || 'Message'}: ${message.content}`}
          accessibilityHint={Platform.OS === 'web' ? 'Click for message actions' : 'Long press for message actions'}
          accessibilityActions={[{ name: 'longpress', label: 'Message actions' }]}
          onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'longpress') onLongPress(message); }}
          onLongPress={() => onLongPress(message)}
          onPress={Platform.OS === 'web' ? () => onLongPress(message) : undefined}
          delayLongPress={280}
          style={({ pressed }) => [styles.bubbleContent, pressed && { opacity: 0.9 }]}
        >
          {message.messageType === 'IMAGE' && attachment && failedAttachment !== attachment && (
            <PrivateImage
              uri={attachment}
              accessibilityLabel={message.attachmentName || 'Shared photo'}
              style={[styles.image, { width: imageWidth, height: imageWidth * 0.8 }]}
              contentFit="cover"
              transition={150}
              onError={() => setFailedAttachment(attachment)}
            />
          )}

          {message.messageType === 'DOCUMENT' && (
            <View style={styles.documentRow}>
              <View style={[styles.documentIcon, own && styles.documentIconOwn]}>
                <Ionicons
                  name="document-text"
                  size={20}
                  color={ChatColors.gold}
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
                color={ChatColors.gold}
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
                  <Ionicons name="alert-circle" size={13} color={ChatColors.danger} />
                ) : message.pending ? (
                  <Ionicons name="time-outline" size={12} color={ChatColors.textSecondary} />
                ) : (
                  <Ionicons
                    accessibilityLabel={read ? 'Read' : delivered ? 'Delivered' : 'Sent'}
                    name={delivered ? 'checkmark-done' : 'checkmark'}
                    size={14}
                    color={read ? ChatColors.success : ChatColors.textSecondary}
                  />
                )}
              </>
            )}
          </View>
          {message.failed && (
            <Text style={styles.failedText}>Not sent · {Platform.OS === 'web' ? 'Click' : 'Hold'} to retry</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    marginVertical: 4,
    flexDirection: 'row',
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 9,
    gap: 4,
  },
  bubbleContent: {
    gap: 4,
  },
  bubbleOwn: {
    backgroundColor: ChatColors.outgoing,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: ChatColors.incoming,
    borderWidth: 1,
    borderColor: ChatColors.border,
    borderBottomLeftRadius: 6,
  },
  bubbleFailed: {
    backgroundColor: '#FCEEEA',
    borderWidth: 1,
    borderColor: '#EDC8BF',
  },
  senderName: {
    ...Typography.caption,
    fontWeight: '600',
    color: ChatColors.gold,
  },
  text: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: ChatColors.text,
  },
  textOwn: {
    color: ChatColors.text,
  },
  image: {
    borderRadius: BorderRadius.md,
    backgroundColor: ChatColors.surfaceMuted,
  },
  imageFallback: {
    height: 150,
    borderRadius: BorderRadius.md,
    backgroundColor: ChatColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  retryPhoto: { ...Typography.caption, color: ChatColors.gold },
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
    backgroundColor: ChatColors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentIconOwn: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  documentName: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: ChatColors.text,
  },
  documentSize: {
    ...Typography.caption,
    color: ChatColors.textSecondary,
  },
  listShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  listShareName: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: ChatColors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    paddingTop: 1,
  },
  time: {
    ...Typography.caption,
    fontSize: 11,
    color: ChatColors.textSecondary,
  },
  metaOwn: {
    color: ChatColors.textSecondary,
  },
  failedText: {
    ...Typography.caption,
    fontSize: 11,
    color: ChatColors.danger,
  },
});
