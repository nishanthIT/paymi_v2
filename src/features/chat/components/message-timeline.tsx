import React, { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, Text, View, type ListViewToken } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, Spacing, Typography } from '@/constants/theme';

import { formatMessageDay, startsMessageDay, topVisibleMessage } from '../thread-dates';
import type { ChatMessage } from '../types';
import { MessageBubble } from './message-bubble';
import { ChatColors } from '../theme';

interface MessageTimelineProps {
  messages: ChatMessage[];
  isGroup: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onLongPress: (message: ChatMessage) => void;
  loadOlderError?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

const VIEWABILITY_CONFIG = { viewAreaCoveragePercentThreshold: 1, minimumViewTime: 50 };

/** Keep the existing inverted message order, actions and history pagination. */
export const MessageTimeline = memo(function MessageTimeline({ messages, isGroup, hasOlder, loadingOlder, onLoadOlder, onLongPress, loadOlderError, emptyTitle = 'Start the conversation', emptyDescription = 'Send a message or share a photo with your team.' }: MessageTimelineProps) {
  const [visibleTimestamp, setVisibleTimestamp] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
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
        onEndReached={() => { if (hasOlder && !loadingOlder && !loadOlderError) onLoadOlder(); }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingOlder ? <ActivityIndicator accessibilityLabel="Loading earlier messages" color={ChatColors.gold} style={styles.loadingOlder} /> : loadOlderError ? (
          <View style={styles.historyError}>
            <Text style={styles.emptyThreadText}>{loadOlderError}</Text>
            <Pressable accessibilityRole="button" onPress={onLoadOlder} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : undefined}
        ListEmptyComponent={(
          <View style={styles.emptyThread}>
            <View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={26} color={ChatColors.gold} /></View>
            <Text style={styles.emptyThreadTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyThreadText}>{emptyDescription}</Text>
          </View>
        )}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />
      {!!floatingDay && (
        <View pointerEvents="none" style={styles.floatingDate} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.datePill}>{floatingDay}</Text>
        </View>
      )}
    </View>
  );
});

/** Shapes reserve the message layout while the first real page is loading. */
export function MessageTimelineSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityRole="progressbar" accessibilityLabel="Loading messages">
      {[false, false, true, false, true].map((own, index) => (
        <View key={index} style={[styles.skeletonBubble, own ? styles.skeletonOwn : styles.skeletonOther, { width: index % 2 ? '48%' : '66%' }]}>
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: '65%' }]} />
          <View style={styles.skeletonTime} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  messagesContent: { paddingVertical: Spacing.md, flexGrow: 1 },
  dateRow: { alignItems: 'center', marginVertical: 12 },
  datePill: {
    ...Typography.caption,
    color: ChatColors.textSecondary,
    backgroundColor: ChatColors.surfaceMuted,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  floatingDate: { position: 'absolute', top: Spacing.xs, left: 0, right: 0, alignItems: 'center' },
  loadingOlder: { marginVertical: Spacing.md },
  emptyThread: { flex: 1, padding: Spacing.xl, alignItems: 'center', justifyContent: 'center', gap: 10, transform: [{ scaleY: -1 }] },
  emptyIcon: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: ChatColors.goldSoft, marginBottom: 6 },
  emptyThreadTitle: { ...Typography.bodyBold, fontSize: 17, color: ChatColors.text, textAlign: 'center' },
  emptyThreadText: { ...Typography.bodySmall, color: ChatColors.textSecondary, textAlign: 'center', maxWidth: 300 },
  historyError: { alignItems: 'center', padding: Spacing.md, gap: 4 },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md },
  retryText: { ...Typography.label, color: ChatColors.gold },
  skeleton: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center', padding: Spacing.md, justifyContent: 'flex-end', gap: 18 },
  skeletonBubble: { padding: 14, borderRadius: 18, gap: 8, maxWidth: 400 },
  skeletonOwn: { alignSelf: 'flex-end', backgroundColor: ChatColors.goldSoft, borderBottomRightRadius: 6 },
  skeletonOther: { alignSelf: 'flex-start', backgroundColor: ChatColors.surface, borderBottomLeftRadius: 6 },
  skeletonLine: { height: 9, width: '88%', backgroundColor: ChatColors.skeleton, borderRadius: 5 },
  skeletonTime: { height: 6, width: 30, alignSelf: 'flex-end', backgroundColor: ChatColors.skeleton, borderRadius: 3, marginTop: 2 },
});
