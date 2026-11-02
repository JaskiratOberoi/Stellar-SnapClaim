import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useWindowDimensions, type ColorValue } from 'react-native';

import { PhoneWidth, Radius } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

type MaterialName = NonNullable<Extract<SymbolViewProps['name'], object>['android']>;
type IosName = NonNullable<Extract<SymbolViewProps['name'], object>['ios']>;

function tabIcon(ios: IosName, material: MaterialName) {
  const Icon = ({ color }: { color: ColorValue }) => (
    <SymbolView name={{ ios, android: material, web: material }} size={22} tintColor={String(color)} />
  );
  return Icon;
}

export default function TabLayout() {
  const theme = useTheme();
  const { can } = useSession();
  const { width } = useWindowDimensions();
  // Phone first: a bar under the thumb, the current tab a dark pill. On a wide window the same tabs become a left rail.
  const rail = width >= PhoneWidth + 180;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarPosition: rail ? 'left' : 'bottom',
        tabBarVariant: rail ? 'material' : 'uikit',
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: theme.textOnAccent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarActiveBackgroundColor: theme.accent,
        tabBarStyle: rail
          ? { backgroundColor: theme.background, borderRightWidth: 0, minWidth: 100, paddingTop: 12 }
          : { backgroundColor: theme.background, borderTopWidth: 0, height: 72, paddingHorizontal: 12 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: 600, letterSpacing: 0.2 },
        tabBarItemStyle: rail
          ? { borderRadius: Radius.pill, marginHorizontal: 10, marginVertical: 3, paddingVertical: 12 }
          : { borderRadius: Radius.pill, marginHorizontal: 4, marginVertical: 10 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Claims', tabBarIcon: tabIcon('doc.text.fill', 'receipt_long') }} />
      <Tabs.Screen
        name="approvals"
        options={{ title: 'Approvals', tabBarIcon: tabIcon('checkmark.seal.fill', 'task_alt'), href: can('claims.approve') ? undefined : null }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Month-end', tabBarIcon: tabIcon('chart.bar.fill', 'bar_chart'), href: can('months.review') ? undefined : null }}
      />
      <Tabs.Screen name="more" options={{ title: 'You', tabBarIcon: tabIcon('person.crop.circle.fill', 'account_circle') }} />
    </Tabs>
  );
}
