import { useAuth } from '@/contexts/AuthContext';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '@/constants/theme';

export default function AboutPaymi() {
  const { privacy } = useLocalSearchParams<{ privacy?: string }>();
  const { isAuthenticated } = useAuth();
  return <SafeAreaView style={styles.page}>
    <Stack.Screen options={{ headerShown: true, title: privacy ? 'Privacy Policy' : 'About Paymi' }} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Your shop workspace</Text>
      <Text style={styles.body}>Paymi is operated by Kaliam for shop owners and their employees. This release is free and does not offer subscriptions or in-app purchases.</Text>
      <Text style={styles.body}>Sign in to access your private shop records, shared lists and team conversations. Owners manage which shops and tools their employees can access.</Text>
      <Text style={styles.heading}>Your information</Text>
      <Text style={styles.body}>Paymi processes your account details and the information you add, such as messages, photos and shop records. Information you share with a shop or chat is available to its authorized members. Some records and label drafts are also saved on your device.</Text>
      <Text style={styles.body}>Camera access is optional. You can enter a barcode manually. Photos are selected when you choose to attach them, and printing or sharing uses your device’s system tools.</Text>
      <Text style={styles.heading}>Support and privacy</Text>
      <Text style={styles.body}>Contact Kaliam at support@paymi.co.uk for help or privacy questions. Do not include passwords or unnecessary customer information.</Text>
      <Text accessibilityRole="link" style={styles.link} onPress={() => Linking.openURL('mailto:support@paymi.co.uk').catch(() => {})}>Email support@paymi.co.uk</Text>
      <Text accessibilityRole="link" style={styles.link} onPress={() => Linking.openURL('tel:+447534333494').catch(() => {})}>Call 07534 333494</Text>
      <Link href="/promotions" style={styles.link}>Browse public promotions</Link>
      {!isAuthenticated && <Link href="/(auth)/forgot-password" style={styles.link}>Recover account access</Link>}
      <Link href="/chat-safety" style={styles.link}>Community rules and chat safety</Link>
      <Link href="/account-deletion" style={styles.link}>Delete your personal account or check a request</Link>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  heading: { ...Typography.h3, color: Colors.light.text },
  body: { ...Typography.body, color: Colors.light.text },
  link: { ...Typography.body, color: Colors.light.primary, paddingVertical: Spacing.sm },
});
