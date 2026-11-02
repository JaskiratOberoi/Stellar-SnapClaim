import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useWindowDimensions, type ColorValue } from 'react-native';

import { SideNav } from '@/components/rail-bar';
import { SidebarWidth } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

type MaterialName = NonNullable<Extract<SymbolViewProps['name'], object>['android']>;
type IosName = NonNullable<Extract<SymbolViewProps['name'], object>['ios']>;

function tabIcon(ios: IosName, material: MaterialName) {
  const Icon = ({ color, size }: { color: ColorValue; size?: number }) => (
    <SymbolView name={{ ios, android: material, web: material }} size={size ?? 22} tintColor={String(color)} />
  );
  return Icon;
}

export default function TabLayout() {
  const theme = useTheme();
  const { can } = useSession();
  const { width } = useWindowDimensions();
  const sidebar = width >= SidebarWidth;
  return (
    <Tabs
      tabBar={sidebar ? (props) => <SideNav {...props} /> : undefined}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        sceneStyle: { backgroundColor: theme.background },
        tabBarPosition: sidebar ? 'left' : 'bottom',
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border, borderTopWidth: 1, height: 64 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: 500 },
        tabBarItemStyle: { paddingVertical: 6 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('house.fill', 'home') }} />
      <Tabs.Screen
        name="approvals"
        options={{ title: 'Approvals', tabBarIcon: tabIcon('checkmark.seal.fill', 'task_alt'), href: can('claims.approve') ? undefined : null }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Month-end', tabBarIcon: tabIcon('chart.bar.fill', 'bar_chart'), href: can('months.review') ? undefined : null }}
      />
      <Tabs.Screen name="more" options={{ title: 'Settings', tabBarIcon: tabIcon('gearshape.fill', 'settings') }} />
    </Tabs>
  );
}
