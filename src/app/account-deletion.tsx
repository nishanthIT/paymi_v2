import { useState } from 'react';
import { Link, Stack } from 'expo-router';
import { Linking, ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { TextField } from '@/components/ui/text-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import api from '@/services/api';
import { API_CONFIG } from '@/config/api';

const statusText: Record<string, string> = {
  REQUESTED: 'Request received; awaiting processing.',
  FILES_PENDING: 'Account removed; file cleanup is in progress.',
  EXTERNAL_REVIEW: 'Account removed. Shared records and external services are under review; deletion is not yet complete.',
  COMPLETE: 'Deletion review completed.',
};
export default function AccountDeletion() {
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [receipt, setReceipt] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (request: boolean) => {
    setBusy(true); setMessage('');
    try {
      const { data } = await api.post(`/account-deletion/${request ? (isAuthenticated ? 'request' : 'request-with-password') : 'status'}`, request ? { email, password, confirmation } : { receipt: receipt.trim() });
      if (data.receipt) setReceipt(data.receipt);
      setMessage(statusText[data.status] || 'Contact support about this request.');
    } catch (error: any) { setMessage(error.response?.data?.error || 'Could not complete the request. Check your connection and try again.'); }
    finally { setPassword(''); setBusy(false); }
  };
  return <SafeAreaView style={styles.page}>
    <Stack.Screen options={{ headerShown: true, title: 'Delete account' }} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Delete your personal account</Text>
      <Text style={styles.body}>Deletion removes your account, memberships, personal lists and authored chat content. You will lose access. Shared shops, other staff accounts and shared operational records remain. Personal details in shared records and external services require review before the request is complete.</Text>
      <Text style={styles.body}>Workspace deletion is a separate authorized action. Submitting this request does not confirm that deletion has finished. Save your private receipt to check progress here or on our website.</Text>
      <>
        {!isAuthenticated && <TextField label="Account email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />}
        <TextField label="Confirm your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
        <TextField label="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} />
        <PrimaryButton title="Request personal account deletion" loading={busy} disabled={(!isAuthenticated && !email.trim()) || !password || confirmation !== 'DELETE'} onPress={() => run(true)} />
      </>
      <Text accessibilityLiveRegion="polite" selectable style={styles.body}>{message}</Text>
      <TextField label="Private request receipt" value={receipt} onChangeText={setReceipt} autoCapitalize="none" autoCorrect={false} />
      <PrimaryButton title="Check deletion status" loading={busy} disabled={!/^[a-f0-9]{64}$/.test(receipt.trim())} onPress={() => run(false)} />
      <Text style={styles.body}>Keep your receipt private. It is not saved automatically when you leave this screen.</Text>
      <PrimaryButton variant="ghost" title="Open deletion website" onPress={() => Linking.openURL(`${new URL(API_CONFIG.BASE_URL).origin}/account-deletion`).catch(() => setMessage('Could not open a browser. Contact support@paymi.co.uk.'))} />
      <Link href="/about" style={styles.link}>Support and privacy information</Link>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: Colors.light.background }, content: { padding: Spacing.lg, gap: Spacing.md }, heading: { ...Typography.h3, color: Colors.light.text }, body: { ...Typography.body, color: Colors.light.text }, link: { ...Typography.body, color: Colors.light.primary, paddingVertical: Spacing.sm } });
