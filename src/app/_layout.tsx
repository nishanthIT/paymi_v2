import { supermarketCacheKey } from '@/features/supermarkets/selection';
import React, { useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AnimatedSplash } from '@/components/animated-splash';
import { ToastProvider } from '@/components/ui/toast';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { registerListMutationDefaults } from '@/features/lists/mutation-defaults';
import { registerPriceReportMutationDefaults } from '@/features/price-reports/hooks';
import {
  QUERY_PERSIST_MAX_AGE,
  createQueryClient,
  createQueryPersister,
  setActiveQueryClient,
} from '@/lib/query-client';

// Keep the native splash visible until the session restore has finished.
SplashScreen.preventAutoHideAsync().catch(() => {});

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.background,
    card: Colors.light.backgroundCard,
    text: Colors.light.text,
    border: Colors.light.border,
    primary: Colors.light.primary,
  },
};

function RootNavigator() {
  const { isAuthenticated, isRestoring } = useAuth();

  return (
    <>
      {/* Preserve the launch URL until auth is known, including saved chat links. */}
      {!isRestoring && (
        <Stack screenOptions={{ headerShown: false }}>
          {/* SDK 58 redirects to hrefs; the auth group itself has no index route. */}
          <Stack.Protected guard={isAuthenticated} redirectTo="/(auth)/login">
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated} redirectTo="/(app)/(tabs)">
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Screen name="promotions" />
          <Stack.Screen name="promotion/[id]" />
          <Stack.Screen name="about" />
          <Stack.Screen name="chat-safety" />
          <Stack.Screen name="account-deletion" />
        </Stack>
      )}
      <AnimatedSplash ready={!isRestoring} />
    </>
  );
}

function ShopCache({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const cacheKey = user ? supermarketCacheKey(user.userType, user.id, user.shopId) : 'signed-out';
  return <ScopedCache key={cacheKey} cacheKey={cacheKey}>{children}</ScopedCache>;
}
function ScopedCache({ children, cacheKey }: { children: React.ReactNode; cacheKey: string }) {
  const [cache] = useState(() => {
    const client = createQueryClient();
    registerListMutationDefaults(client);
    registerPriceReportMutationDefaults(client);
    setActiveQueryClient(client);
    return { client, persister: createQueryPersister(cacheKey) };
  });
  return <PersistQueryClientProvider client={cache.client}
    persistOptions={{ persister: cache.persister, maxAge: QUERY_PERSIST_MAX_AGE, buster: 'verified-supermarket-v2' }}
    onSuccess={() => { cache.client.resumePausedMutations().then(() => cache.client.invalidateQueries()); }}>
    {children}
  </PersistQueryClientProvider>;
}
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ShopCache>
          <ThemeProvider value={navigationTheme}>
            <ToastProvider>
              <RootNavigator />
              <StatusBar style="dark" />
            </ToastProvider>
          </ThemeProvider>
        </ShopCache>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
