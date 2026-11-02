import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChatColors as C } from '../theme';

export function ChatNotice({ title, message, action, onAction, busy = false }: {
  title?: string; message: string; action?: string; onAction?: () => void; busy?: boolean;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      <Ionicons name="information-circle-outline" size={19} color={C.gold} />
      <View style={styles.noticeCopy}>
        {!!title && <Text style={styles.noticeTitle}>{title}</Text>}
        <Text style={styles.noticeMessage}>{message}</Text>
      </View>
      {onAction && <Pressable accessibilityRole="button" accessibilityLabel={action ?? 'Retry'}
        disabled={busy} onPress={onAction} style={styles.action}>
        {busy ? <ActivityIndicator size="small" color={C.gold} /> : <Text style={styles.actionText}>{action ?? 'Retry'}</Text>}
      </Pressable>}
    </View>
  );
}

export function ChatListSkeleton({ count = 6 }: { count?: number }) {
  return <View accessible accessibilityLabel="Loading conversations" accessibilityRole="progressbar" style={styles.skeletons}>
    {Array.from({ length: count }, (_, index) => <View key={index} style={styles.skeletonRow}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonCopy}>
        <View style={[styles.skeletonLine, { width: index % 2 ? '45%' : '62%' }]} />
        <View style={[styles.skeletonLine, { width: index % 2 ? '76%' : '88%', height: 10 }]} />
      </View>
      <View style={[styles.skeletonLine, { width: 28, height: 9 }]} />
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20,
    marginVertical: 8, padding: 12, borderRadius: 14, backgroundColor: C.surfaceMuted },
  noticeCopy: { flex: 1, minWidth: 0, gap: 3 },
  noticeTitle: { fontSize: 13, fontWeight: '600', color: C.text },
  noticeMessage: { fontSize: 12, lineHeight: 18, color: C.textSecondary },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: C.gold, fontSize: 13, fontWeight: '600' },
  skeletons: { paddingHorizontal: 20 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18 },
  skeletonAvatar: { height: 48, width: 48, borderRadius: 18, backgroundColor: C.skeleton },
  skeletonCopy: { flex: 1, gap: 12 },
  skeletonLine: { height: 13, borderRadius: 5, backgroundColor: C.skeleton },
});
