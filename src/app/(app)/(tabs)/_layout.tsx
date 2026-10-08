import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Shadows } from '@/constants/theme';
import { useChatRealtime, useUnreadCount } from '@/features/chat/hooks/use-chats';
import { useShopFeature } from '@/features/employees/permissions';
import { useTemperatureAlerts } from '@/features/fridges/hooks/use-temperature-alerts';
import { useListRealtime } from '@/features/lists/hooks/use-list-realtime';
import { useTaskNotifications } from '@/features/tasks/hooks/use-task-notifications';

/** Bottom tabs: Home, Lists, Chat, Profile. */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 8) : insets.bottom;

  // Keep chats, unread badge and open threads live app-wide.
  useChatRealtime();
  // Keep shared shopping lists in sync in real time (owner + employees).
  useListRealtime();
  // Surface out-of-range temperature readings as instant notifications.
  useTemperatureAlerts();
  // Employees get newly assigned tasks live.
  useTaskNotifications();
  const unreadCount = useUnreadCount();
  const canUseLists = useShopFeature('feature.lists');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors.light.backgroundCard,
          borderTopColor: Colors.light.border,
          height: 56 + bottomPadding + 8,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          ...Shadows.sm,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists',
          // Hidden for employees whose shop owner switched lists off.
          href: canUseLists ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.light.primary,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
