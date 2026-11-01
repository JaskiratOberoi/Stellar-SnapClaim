import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

type MaterialName = NonNullable<Extract<SymbolViewProps['name'], object>['android']>;
type IosName = NonNullable<Extract<SymbolViewProps['name'], object>['ios']>;

function tabIcon(ios: IosName, material: MaterialName) {
  const Icon = ({ color }: { color: ColorValue }) => (
    <SymbolView name={{ ios, android: material, web: material }} size={24} tintColor={String(color)} />
  );
  return Icon;
}

export default function TabLayout() {
  const theme = useTheme();
  const { can } = useSession();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
        tabBarLabelStyle: { fontWeight: 600 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'My claims', tabBarIcon: tabIcon('doc.text.fill', 'receipt_long') }} />
      <Tabs.Screen
        name="approvals"
        options={{ title: 'Approvals', tabBarIcon: tabIcon('checkmark.seal.fill', 'task_alt'), href: can('claims.approve') ? undefined : null }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Month-end', tabBarIcon: tabIcon('chart.bar.fill', 'bar_chart'), href: can('months.review') ? undefined : null }}
      />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: tabIcon('person.crop.circle.fill', 'account_circle') }} />
    </Tabs>
  );
}
