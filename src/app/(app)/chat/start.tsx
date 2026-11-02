import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatNotice } from '@/features/chat/components/chat-feedback';
import { MessageTimelineSkeleton } from '@/features/chat/components/message-timeline';
import { getChatErrorState } from '@/features/chat/errors';
import { useChatConnection } from '@/features/chat/hooks/use-chat-connection';
import { useCreateChat } from '@/features/chat/hooks/use-chats';
import { ChatColors as C, chatInitials } from '@/features/chat/theme';

/** Back/cancel never navigates later when a slow room-creation response arrives. */
export default function StartDirectChatScreen() {
  const { userId, userType, name } = useLocalSearchParams<{ userId: string; userType: string; name?: string }>();
  const router = useRouter();
  const focused = useIsFocused();
  const { isOnline } = useChatConnection();
  const { mutateAsync, error, isPending } = useCreateChat();
  const [attempt, setAttempt] = useState(0);
  const closed = useRef(false);
  const recipientId = Number(userId);
  const valid = Number.isSafeInteger(recipientId) && recipientId > 0 && (userType === 'CUSTOMER' || userType === 'EMPLOYEE');
  useEffect(() => {
    if (!focused || !valid || !isOnline) return;
    let cancelled = false;
    void mutateAsync({ type: 'PERSONAL', participantIds: [{ userId: recipientId, userType }] }).then(chat => {
      if (!cancelled && !closed.current) router.replace({ pathname: '/(app)/chat/[id]', params: { id: chat.id, name: name ?? chat.name, type: 'PERSONAL' } });
    }).catch(() => { /* The mutation exposes a retryable error below. */ });
    return () => { cancelled = true; };
  }, [focused, valid, isOnline, recipientId, userType, name, mutateAsync, router, attempt]);
  const problem = error && !isPending ? getChatErrorState(error) : null;
  const close = () => {
    closed.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)/chat');
  };
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel opening conversation" onPress={close} style={styles.button}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={styles.avatar}><Text style={styles.initials}>{chatInitials(name ?? 'Chat')}</Text></View>
        <View style={styles.heading}><Text numberOfLines={1} style={styles.name}>{name ?? 'Direct message'}</Text>
          <Text style={styles.subtitle}>Personal conversation</Text></View>
      </View>
      {!valid ? <ChatNotice title="Contact unavailable" message="Open New chat and select an eligible shop user." />
        : !isOnline ? <ChatNotice title="Waiting for a connection" message="Your conversation will open when you’re back online. You can go back at any time." />
        : problem ? <ChatNotice title={problem.title} message={problem.message} action="Try again"
          onAction={problem.retryable ? () => setAttempt(value => value + 1) : undefined} />
        : <><View accessibilityLiveRegion="polite" style={styles.progress}>
          <ActivityIndicator size="small" color={C.gold} /><Text style={styles.subtitle}>Opening conversation…</Text>
        </View><MessageTimelineSkeleton /></>}
      <View style={styles.footer}><Text style={styles.hint}>You can go back at any time.</Text></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.canvas },
  header: { width: '100%', maxWidth: 960, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  button: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { color: C.gold, fontWeight: '600' }, heading: { flex: 1, gap: 4 },
  name: { color: C.text, fontSize: 16, fontWeight: '600' }, subtitle: { color: C.textSecondary, fontSize: 12 },
  progress: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 18 },
  footer: { marginTop: 'auto', padding: 20 }, hint: { color: C.muted, fontSize: 12, textAlign: 'center' },
});
