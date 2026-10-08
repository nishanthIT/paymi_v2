import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: Colors.light.background,
        },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="list/[id]" />
      <Stack.Screen name="add-product" />
      <Stack.Screen
        name="scanner"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="collect" />
      <Stack.Screen name="report-price" />
      <Stack.Screen name="employees" />
      <Stack.Screen name="employee/[id]" />
      <Stack.Screen name="employee/list/[listId]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="news/[id]" />
      <Stack.Screen name="promotions" />
      <Stack.Screen name="promotion/[id]" />
      <Stack.Screen name="manage-expiry" />
      <Stack.Screen name="task-management" />
      <Stack.Screen name="fridge-temperature" />
      <Stack.Screen name="cleaning-status" />
      <Stack.Screen name="incident-logs" />
      <Stack.Screen name="age-restriction-records" />
      <Stack.Screen name="certificate-management" />
      <Stack.Screen name="certificate/[id]" />
      <Stack.Screen name="labels/index" />
      <Stack.Screen name="labels/shelf" />
      <Stack.Screen name="labels/reduced" />
      <Stack.Screen name="labels/templates" />
      <Stack.Screen name="labels/template/[id]" />
      <Stack.Screen name="labels/mixed" />
      <Stack.Screen name="labels/runner" />
      <Stack.Screen name="waste-management-record" />
      <Stack.Screen name="supplier-payout-record" />
      <Stack.Screen name="vat-calculator" />
      <Stack.Screen name="profit-calculator" />
      <Stack.Screen name="shift-sheet" />
      <Stack.Screen name="compare-products" />
      <Stack.Screen name="compare/[productId]" />
    </Stack>
  );
}
