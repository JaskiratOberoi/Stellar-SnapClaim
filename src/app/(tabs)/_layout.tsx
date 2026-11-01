import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol, type SymbolViewProps } from 'expo-symbols';
import { Platform, type ColorValue } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MaterialSymbol = NonNullable<Extract<SymbolViewProps['name'], object>['android']>;

function tabIcon(ios: SFSymbol, material: MaterialSymbol) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <SymbolView name={{ ios, android: material, web: material }} tintColor={color ?? undefined} size={size} />;
  };
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          ...(Platform.OS === 'web' ? { height: 60, paddingBottom: 6, paddingTop: 6 } : null),
        },
        tabBarLabelStyle: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: theme.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('sun.max.fill', 'wb_sunny') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: tabIcon('checklist', 'checklist') }} />
      <Tabs.Screen name="expenses" options={{ title: 'Expenses', tabBarIcon: tabIcon('indianrupeesign.circle.fill', 'payments') }} />
      <Tabs.Screen name="chat" options={{ title: 'Assistant', tabBarIcon: tabIcon('bubble.left.and.bubble.right.fill', 'forum') }} />
    </Tabs>
  );
}
