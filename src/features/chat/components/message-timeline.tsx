import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, StyleSheet, Text, View, type ViewToken } from 'react-native';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';

import { formatMessageDay, startsMessageDay, topVisibleMessage } from '../thread-dates';
import type { ChatMessage } from '../types';
import { MessageBubble } from './message-bubble';

interface MessageTimelineProps {
  messages: ChatMessage[];
  isGroup: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onLongPress: (message: ChatMessage) => void;
}

const VIEWABILITY_CONFIG = { viewAreaCoveragePercentThreshold: 1, minimumViewTime: 50 };

/** Keep the existing inverted message order, actions and history pagination. */
export function MessageTimeline({ messages, isGroup, hasOlder, loadingOlder, onLoadOlder, onLongPress }: MessageTimelineProps) {
  const [visibleTimestamp, setVisibleTimestamp] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<ChatMessage>[] }) => {
    setVisibleTimestamp(topVisibleMessage(viewableItems)?.timestamp ?? null);
  }, []);

  useEffect(() => {
    // Refresh Today/Yesterday when an open chat crosses midnight or resumes in
    // another time zone, even if no new messages arrive.
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const current = new Date();
      setNow(current);
      clearTimeout(timer);
      const midnight = new Date(current);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, midnight.getTime() - current.getTime() + 50);
    };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);

  const floatingDay = messages.length ? formatMessageDay(visibleTimestamp, now) : '';

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        inverted
        extraData={now}
        renderItem={({ item, index }) => (
          <View>
            {startsMessageDay(messages, index) && (
              <View style={styles.dateRow}>
                <Text accessibilityRole="header" style={styles.datePill}>{formatMessageDay(item.timestamp, now)}</Text>
              </View>
            )}
            <MessageBubble message={item} isGroup={isGroup} onLongPress={onLongPress} />
          </View>
        )}
        contentContainerStyle={styles.messagesContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 40 }}
        onEndReached={() => { if (hasOlder && !loadingOlder) onLoadOlder(); }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingOlder ? <ActivityIndicator color={Colors.light.primary} style={styles.loadingOlder} /> : null}
        ListEmptyComponent={<View style={styles.emptyThread}><Text style={styles.emptyThreadText}>No messages yet — say hello </Text></View>}
        keyboardShouldPersistTaps="handled"
      />
      {!!floatingDay && (
        <View pointerEvents="none" style={styles.floatingDate} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.datePill}>{floatingDay}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  messagesContent: { paddingVertical: Spacing.sm },
  dateRow: { alignItems: 'center', marginVertical: Spacing.sm },
  datePill: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    backgroundColor: 'rgba(232, 237, 241, 0.9)',
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  floatingDate: { position: 'absolute', top: Spacing.xs, left: 0, right: 0, alignItems: 'center' },
  loadingOlder: { marginVertical: Spacing.md },
  emptyThread: { padding: Spacing.xl, alignItems: 'center', transform: [{ scaleY: -1 }] },
  emptyThreadText: { ...Typography.body, color: Colors.light.textSecondary },
});
