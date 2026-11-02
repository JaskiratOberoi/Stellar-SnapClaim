import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, useWindowDimensions, type ColorValue } from 'react-native';

import { PhoneWidth } from '@/constants/theme';
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
  const { width } = useWindowDimensions();
  // Phone first: a bottom bar under the thumb. On a wide window the same tabs become a left rail.
  const rail = width >= PhoneWidth + 180;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarPosition: rail ? 'left' : 'bottom',
        tabBarVariant: rail ? 'material' : 'uikit',
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarActiveBackgroundColor: rail ? theme.accentSoft : undefined,
        tabBarStyle: rail
          ? { backgroundColor: theme.background, borderRightColor: theme.border, borderRightWidth: StyleSheet.hairlineWidth, minWidth: 96 }
          : { backgroundColor: theme.background, borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarLabelStyle: { fontSize: 11, fontWeight: 700 },
        tabBarItemStyle: rail ? { borderRadius: 14, marginHorizontal: 8, marginVertical: 2 } : undefined,
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
