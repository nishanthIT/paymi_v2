import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { hasAmbiguousLegacyLabels } from '../model/storage-scope';

export function LegacyLabelNotice() {
  const { user } = useAuth();
  const key = `${user?.userType}:${user?.id}:${user?.shopId}`;
  const [foundFor, setFoundFor] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    AsyncStorage.getAllKeys().then(keys => {
      if (!cancelled && hasAmbiguousLegacyLabels(keys, user.id, String(user.shopId ?? 'none'))) setFoundFor(key);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [key, user]);
  if (foundFor !== key) return null;
  return <Text accessibilityRole="link" style={{ padding: 12 }} onPress={() => Linking.openURL('mailto:support@paymi.co.uk?subject=Earlier%20label%20drafts').catch(() => {})}>
    Earlier label drafts are preserved on this device. Their account ownership needs checking before they can be reopened. Contact support@paymi.co.uk; do not uninstall the app or clear its storage.
  </Text>;
}
