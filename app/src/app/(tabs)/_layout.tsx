import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/** Below this width the nav is a floating pill under the thumb; from here it is a rail on the left. */
export const RailWidth = PhoneWidth + 180;

export default function TabLayout() {
  const theme = useTheme();
  const { can } = useSession();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rail = width >= RailWidth;
  const lift = { shadowColor: theme.shadow, shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 };
  return (
    <Tabs
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        sceneStyle: { backgroundColor: theme.background },
        tabBarPosition: rail ? 'left' : 'bottom',
        tabBarVariant: rail ? 'material' : 'uikit',
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: theme.textOnAccent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarActiveBackgroundColor: theme.accent,
        tabBarStyle: rail
          ? { backgroundColor: theme.surfaceRaised, borderRightWidth: 0, width: 132, margin: 16, marginRight: 0, borderRadius: Radius.large, paddingVertical: 12, ...lift }
          : {
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: Math.max(insets.bottom, 12),
              height: 68,
              borderTopWidth: 0,
              borderRadius: Radius.pill,
              backgroundColor: theme.surfaceRaised,
              paddingHorizontal: 8,
              ...lift,
            },
        tabBarLabelStyle: { fontSize: 11, fontWeight: 600, letterSpacing: 0.2 },
        tabBarItemStyle: rail
          ? { borderRadius: Radius.pill, marginHorizontal: 10, marginVertical: 3, paddingVertical: 12 }
          : { borderRadius: Radius.pill, marginHorizontal: 2, marginVertical: 8 },
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
