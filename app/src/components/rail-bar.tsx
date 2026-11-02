import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Tap } from '@/motion/tap';
import { webTransition } from '@/motion/transition';

/** The slice of the navigator's tab bar props the sidebar needs; the rest is left to the library. */
type SideNavProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode } }>;
  navigateToTab: (routeKey: string) => void;
};

/** The wide-window nav: the wordmark, then one quiet row per tab; the current one sits on the sunken tone. */
export function SideNav({ state, descriptors, navigateToTab }: SideNavProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { backgroundColor: theme.background, borderRightColor: theme.border, paddingTop: insets.top + Spacing.four }]}>
      <ThemedText type="serif" style={styles.wordmark}>
        SnapClaim
      </ThemedText>
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key];
        const focused = state.index === i;
        const color = focused ? theme.text : theme.textSecondary;
        return (
          <Tap
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.title ?? route.name}
            scale={0.98}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
            style={({ pressed }) => [styles.item, { backgroundColor: focused ? theme.backgroundElement : pressed ? theme.backgroundSelected : 'transparent' }, webTransition('background-color')]}>
            {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: 18 }) : null}
            <ThemedText type={focused ? 'smallSemi' : 'small'} style={{ color }} numberOfLines={1}>
              {options.title ?? route.name}
            </ThemedText>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { width: 208, borderRightWidth: 1, paddingHorizontal: Spacing.three, gap: Spacing.half },
  wordmark: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.four, fontSize: 28, lineHeight: 34 },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + Spacing.half, paddingHorizontal: Spacing.two + Spacing.half, paddingVertical: Spacing.two + Spacing.half, borderRadius: Radius.small },
});
