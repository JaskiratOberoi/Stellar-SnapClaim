import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle?: string;
  /** Rendered at the right of the header. */
  action?: ReactNode;
  children: ReactNode;
};

/** Full-height tab screen with a consistent header, capped to a readable width on large displays. */
export function Screen({ title, subtitle, action, children }: Props) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.titles}>
            <ThemedText type="subtitle" style={styles.title}>
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {action}
        </View>
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </ThemedView>
  );
}

export function SettingsAction({ onPress }: { onPress: () => void }) {
  return <IconButton ios="gearshape.fill" material="settings" label="Settings" onPress={onPress} />;
}

export function SectionTitle({ children, trailing }: { children: string; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionText}>
        {children.toUpperCase()}
      </ThemedText>
      {trailing}
    </View>
  );
}

export function EmptyNote({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  titles: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  body: {
    flex: 1,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
  },
  sectionText: {
    letterSpacing: 0.8,
    fontSize: 12,
  },
  empty: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
