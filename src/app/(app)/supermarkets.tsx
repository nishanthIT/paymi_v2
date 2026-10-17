import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { createSupermarket, setDefaultSupermarket } from '@/features/supermarkets/api';
import { Skeleton } from '@/components/ui/skeleton';

const c = Colors.light;
export default function SupermarketsScreen() {
  const router = useRouter();
  const { user, supermarkets, activeSupermarket, canCreateSupermarket, shopsError, refreshSupermarkets, switchSupermarket } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(shopsError);
  const [switching, setSwitching] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [ready, setReady] = useState<{ id: string; name: string } | null>(null);
  const [creatingError, setCreatingError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const draftKey = `paymi.shop-creation.${user?.userType}.${user?.id}`;
  const create = useMutation({ mutationFn: createSupermarket, networkMode: 'always', retry: false });
  const changeDefault = useMutation({ mutationFn: setDefaultSupermarket, networkMode: 'always', onSuccess: refreshSupermarkets });
  const refresh = async () => {
    setLoading(true); setError(null);
    try { await refreshSupermarkets(); } catch { setError('We couldn’t refresh your shops. Check your connection and try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    refreshSupermarkets().catch(() => {
      if (active) setError('We couldn’t refresh your shops. Check your connection and try again.');
    });
    return () => { active = false; };
  }, [refreshSupermarkets]);
  const switchTo = async (id: string) => {
    setSwitching(id); setError(null);
    try { await switchSupermarket(id); router.replace('/(app)/(tabs)'); }
    catch (err: any) { setError(err.message || 'Unable to switch shops. Please try again.'); }
    finally { setSwitching(null); }
  };
  const openCreation = async () => {
    setCreatingError(null); setReady(null);
    const saved = await AsyncStorage.getItem(draftKey);
    if (saved) { const draft = JSON.parse(saved); setName(draft.name); setAddress(draft.address); }
    else { setName(''); setAddress(''); }
    setOpen(true);
  };
  const submit = async () => {
    if (submitLock.current) return;
    if (!name.trim()) { setCreatingError('Give your shop a name to get started.'); return; }
    submitLock.current = true; setCreatingError(null);
    try {
      const previous = await AsyncStorage.getItem(draftKey);
      const saved = previous ? JSON.parse(previous) : null;
      const input = { name: name.trim(), address: address.trim(), requestKey: saved?.requestKey ?? `shop_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}` };
      // Keep the exact payload after a lost response. The server rejects reuse with different details.
      if (saved && (saved.name !== input.name || saved.address !== input.address)) {
        setCreatingError('Retry the original shop details first so we can confirm whether it was created.'); return;
      }
      await AsyncStorage.setItem(draftKey, JSON.stringify(input));
      const result = await create.mutateAsync(input);
      await AsyncStorage.removeItem(draftKey);
      setReady(result.shop);
      await refreshSupermarkets();
    } catch (err: any) { setCreatingError(err?.response?.data?.error || 'We couldn’t confirm creation. Retry with the same details; your shop will only be created once.'); }
    finally { submitLock.current = false; }
  };
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.iconButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={c.text} /></Pressable>
      <Text style={styles.title}>My Supermarkets</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh shops" style={styles.iconButton} onPress={refresh}><Ionicons name="refresh-outline" size={22} color={c.text} /></Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>YOUR BUSINESS, IN ONE PLACE</Text>
      <Text style={styles.heading}>A space for every shop.</Text>
      <Text style={styles.subtitle}>Switch shops to see their lists, people and daily records.</Text>
      {(error || shopsError) && <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error || shopsError}</Text></View>}
      {loading && !supermarkets.length ? [1, 2].map((key) => <Skeleton key={key} width="100%" height={160} radius={20} />) : supermarkets.map((shop, index) => {
        const active = shop.id === activeSupermarket?.id;
        return <Animated.View key={shop.id} entering={FadeInDown.duration(220).delay(index * 40)} style={[styles.card, active && styles.activeCard]}>
          <View style={styles.row}><View style={styles.shopIcon}><Ionicons name="storefront-outline" size={25} color={c.text} /></View>
            <View style={styles.flex}><Text style={styles.shopName}>{shop.name}</Text><Text style={styles.detail}>{shop.address || 'Your shop'}{shop.employeeCount !== undefined ? ` · ${shop.employeeCount} ${shop.employeeCount === 1 ? 'employee' : 'employees'}` : ''}</Text></View>
            {active && <View style={styles.badge}><Text style={styles.badgeText}>Active</Text></View>}
          </View>
          {shop.isDefault && <Text style={styles.defaultLabel}>★ Default shop</Text>}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${shop.name}`} disabled={active || !!switching} style={[styles.switchButton, active && styles.disabled]} onPress={() => switchTo(shop.id)}>
              {switching === shop.id ? <ActivityIndicator color={c.text} /> : <Text style={styles.actionText}>{active ? 'Current shop' : 'Switch to shop'}</Text>}
            </Pressable>
            {shop.role === 'OWNER' && active && <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push('/(app)/employees')}><Text style={styles.actionText}>Employees</Text></Pressable>}
            {shop.role === 'OWNER' && !shop.isDefault && <Pressable accessibilityRole="button" disabled={changeDefault.isPending} style={styles.secondary} onPress={() => changeDefault.mutate(shop.id, { onError: () => setError('Unable to change the default. Please try again.') })}><Text style={styles.actionText}>Set default</Text></Pressable>}
          </View>
        </Animated.View>;
      })}
      {!loading && !supermarkets.length && <View style={styles.card}><Ionicons name="storefront-outline" size={36} color={c.textSecondary} /><Text style={styles.shopName}>Your shops will appear here</Text><Text style={styles.subtitle}>If you already have a shop, contact support to verify its connection to your account. Your existing records are kept safely.</Text></View>}
      {canCreateSupermarket && <Pressable accessibilityRole="button" style={styles.primary} onPress={openCreation}><Ionicons name="add" size={22} color={c.text} /><Text style={styles.primaryText}>Add New Supermarket</Text></Pressable>}
    </ScrollView>
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!create.isPending) setOpen(false); }}>
      <SafeAreaView style={styles.screen}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.header}><Text style={styles.title}>{ready ? 'All set' : 'Add a supermarket'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={create.isPending} style={styles.iconButton} onPress={() => setOpen(false)}><Ionicons name="close" size={26} color={c.text} /></Pressable></View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {ready ? <><View style={styles.successIcon}><Ionicons name="checkmark" size={38} color={c.success} /></View><Text style={styles.heading}>Your shop is ready!</Text><Text style={styles.subtitle}>{ready.name} has its own lists, employees and daily records.</Text><Pressable accessibilityRole="button" style={styles.primary} onPress={() => { setOpen(false); void switchTo(ready.id); }}><Text style={styles.primaryText}>Switch to {ready.name}</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => setOpen(false)}><Text style={styles.actionText}>Keep working in my current shop</Text></Pressable></> : <>
            <View style={styles.shopIcon}><Ionicons name="storefront-outline" size={28} color={c.text} /></View><Text style={styles.heading}>Make room for your next shop.</Text><Text style={styles.subtitle}>Start with a name your team will recognise. You’ll use your existing PayMi account.</Text>
            <Text style={styles.label}>Supermarket name</Text><TextInput accessibilityLabel="Supermarket name" placeholder="e.g. London Mini Mart — High Street" placeholderTextColor={c.textLight} style={styles.input} value={name} onChangeText={setName} maxLength={200} autoCapitalize="words" editable={!create.isPending} returnKeyType="next" />
            <Text style={styles.label}>Location <Text style={styles.optional}>(optional)</Text></Text><TextInput accessibilityLabel="Shop location" placeholder="Town, postcode or address" placeholderTextColor={c.textLight} style={styles.input} value={address} onChangeText={setAddress} maxLength={1000} editable={!create.isPending} />
            {creatingError && <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{creatingError}</Text></View>}
            <Pressable accessibilityRole="button" disabled={create.isPending} style={[styles.primary, create.isPending && styles.disabled]} onPress={submit}>{create.isPending ? <ActivityIndicator color={c.text} /> : <Text style={styles.primaryText}>Create My Shop</Text>}</Pressable>
          </>}
        </ScrollView>
      </KeyboardAvoidingView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, title: { flex: 1, fontSize: 20, fontWeight: '700', color: c.text },
  content: { padding: 24, gap: 18, paddingBottom: 48, width: '100%', maxWidth: 680, alignSelf: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: c.textSecondary }, heading: { fontSize: 30, lineHeight: 37, fontWeight: '700', color: c.text },
  subtitle: { color: c.textSecondary, fontSize: 15, lineHeight: 23 }, card: { padding: 20, gap: 16, borderRadius: 22, backgroundColor: c.backgroundCard, borderWidth: 1, borderColor: c.border }, activeCard: { borderColor: c.primary, backgroundColor: c.surfaceAlt },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, shopIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' }, shopName: { color: c.text, fontWeight: '700', fontSize: 18 }, detail: { color: c.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  badge: { borderRadius: 12, backgroundColor: c.primaryLight, paddingHorizontal: 10, paddingVertical: 6 }, badgeText: { fontSize: 12, fontWeight: '700', color: c.text }, defaultLabel: { fontSize: 12, color: c.textSecondary }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchButton: { backgroundColor: c.primaryLight, borderRadius: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 }, secondary: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 }, actionText: { color: c.text, fontWeight: '600', fontSize: 13 },
  primary: { minHeight: 54, padding: 15, borderRadius: 16, backgroundColor: c.accent, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: c.text, fontSize: 16, fontWeight: '700', flexShrink: 1 }, disabled: { opacity: 0.55 },
  label: { color: c.text, fontWeight: '600', fontSize: 14 }, optional: { color: c.textSecondary, fontWeight: '400' }, input: { minHeight: 54, borderRadius: 14, paddingHorizontal: 16, backgroundColor: c.backgroundCard, borderWidth: 1, borderColor: c.borderStrong, color: c.text, fontSize: 16 }, error: { padding: 14, backgroundColor: '#FBECE8', borderRadius: 12 }, errorText: { color: c.error, fontSize: 14, lineHeight: 21 }, successIcon: { width: 72, height: 72, backgroundColor: '#E9F2E5', borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
