import { useState } from 'react';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { disconnectChatSocket } from '@/features/chat/socket';

export default function ChatSafety() {
  const { messageId } = useLocalSearchParams<{ messageId?: string }>();
  const { isAuthenticated } = useAuth();
  const client = useQueryClient();
  const safety = useQuery({ queryKey: ['chat-safety'], queryFn: async () => (await api.get('/chat-safety')).data, enabled: isAuthenticated });
  const [reason, setReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const action = async (route: string, body: object, text: string, method = 'POST') => {
    setBusy(true); setResult('');
    try {
      await api.request({ url: `/chat-safety/${route}`, method, data: body });
      if (route === 'report') setReported(true);
      if (route.startsWith('block')) {
        disconnectChatSocket();
        await client.cancelQueries({ predicate: q => ['chat', 'chats', 'chat-users'].includes(String(q.queryKey[0])) });
        client.removeQueries({ predicate: q => ['chat', 'chats', 'chat-users'].includes(String(q.queryKey[0])) });
      }
      await safety.refetch(); setResult(text);
    } catch (error: any) { setResult(error.response?.data?.error || 'Could not complete this action. Try again or contact support.'); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.page}>
    <Stack.Screen options={{ headerShown: true, title: 'Chat safety' }} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Community rules</Text>
      <Text style={styles.body}>Use Paymi for respectful business conversations. Do not post harassment, threats, sexual content, child exploitation, hateful or illegal material, scams, spam, or information you do not have permission to share. Do not use chat to arrange sales of age-restricted goods to minors.</Text>
      <Text style={styles.body}>Keep shop and customer information within authorized team conversations. ALL Chat is available to registered users beyond your shop. Reports are available to Kaliam moderators, who can remove reported content and restrict chat posting or temporarily suspend account access. Authorized moderators can inspect the reported message, limited surrounding context and related reports. Contact support@paymi.co.uk for safety concerns or to challenge a moderation decision.</Text>
      <Text style={styles.body}>Long-press a message and choose Report Message to report content or its sender. Blocking hides messages between you and that user and prevents direct conversations. It does not change anyone’s shop permissions.</Text>
      {safety.data?.suspension && <Text accessibilityRole="alert" style={styles.body}>Chat posting is suspended until {new Date(safety.data.suspension.until).toLocaleString()}. {safety.data.suspension.reason} Private shop tools remain available. Contact support@paymi.co.uk to appeal.</Text>}
      {!!safety.error && <PrimaryButton title="Retry loading safety settings" onPress={() => safety.refetch()} />}
      {isAuthenticated && messageId && <>
        <Text style={styles.heading}>Report this message or its sender</Text>
        {!reported && <>
          {([['ABUSE', 'Harassment or bullying'], ['SPAM', 'Spam or unwanted messages'], ['THREATS', 'Threats or abusive content'], ['INAPPROPRIATE', 'Inappropriate content'], ['SCAM', 'Scam or suspicious activity'], ['CHILD_SAFETY', 'Child safety concern'], ['OTHER', 'Other']] as const).map(([value, label]) => <PrimaryButton key={value} variant={reason === value ? 'primary' : 'ghost'} title={label} disabled={busy} onPress={() => setReason(value)} />)}
          <TextInput accessibilityLabel="Optional report explanation" placeholder="Additional explanation (optional)" multiline maxLength={1000} value={explanation} onChangeText={setExplanation} style={[styles.body, { borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, padding: Spacing.md, minHeight: 80 }]} />
          <PrimaryButton title="Submit report" loading={busy} disabled={!reason} onPress={() => action('report', { messageId, reason, explanation }, 'Report received for moderator review. You can also block the sender below.')} />
        </>}
        <PrimaryButton title="Block this sender" loading={busy} onPress={() => action('block', { messageId }, 'Sender blocked. Their messages are hidden; return to chat to refresh.')} />
      </>}
      <Text accessibilityLiveRegion="polite" style={styles.body}>{result}</Text>
      {!!safety.data?.blocks?.length && <Text style={styles.heading}>Blocked accounts</Text>}
      {safety.data?.blocks?.map((block: { id: string; blockedId: number; blockedType: string }) => <PrimaryButton key={block.id} variant="ghost" title={`Unblock ${block.blockedType.toLowerCase()} ${block.blockedId}`} loading={busy} onPress={() => action(`block/${block.id}`, {}, 'Account unblocked.', 'DELETE')} />)}
      <Link href="/about" style={styles.link}>Support and privacy</Link>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: Colors.light.background }, content: { padding: Spacing.lg, gap: Spacing.md }, heading: { ...Typography.h3, color: Colors.light.text }, body: { ...Typography.body, color: Colors.light.text }, link: { ...Typography.body, color: Colors.light.primary } });
