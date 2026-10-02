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
  queryClient,
  queryPersister,
} from '@/lib/query-client';

// Keep the native splash visible until the session restore has finished.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Allow offline mutations persisted to disk to be resumed after restart.
registerListMutationDefaults(queryClient);
registerPriceReportMutationDefaults(queryClient);

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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      <AnimatedSplash ready={!isRestoring} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: QUERY_PERSIST_MAX_AGE }}
        onSuccess={() => {
          // Replay any mutations queued while offline, then refresh.
          queryClient.resumePausedMutations().then(() => {
            queryClient.invalidateQueries();
          });
        }}
      >
        <AuthProvider>
          <ThemeProvider value={navigationTheme}>
            <ToastProvider>
              <RootNavigator />
              <StatusBar style="dark" />
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
