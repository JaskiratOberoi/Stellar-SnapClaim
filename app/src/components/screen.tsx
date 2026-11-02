import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PageEnter } from '@/motion/page-enter';
import { Tap } from '@/motion/tap';

type Props = {
  title: string;
  /** Tracked caps above the title: a date, a name, a count. */
  subtitle?: string;
  action?: ReactNode;
  back?: boolean;
  /** How many lines the serif title may take. A greeting takes two. */
  titleLines?: number;
  /** Let the content run the full width of the window (a two-column page lays itself out). */
  wide?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Page frame: safe-area header with eyebrow, serif title, optional back button and action; content centred at MaxContentWidth. */
export function Screen({ title, subtitle, action, back, titleLines = 1, wide, children, style }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={[styles.headerInner, wide && styles.wide]}>
          {back ? (
            <Tap
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              scale={0.88}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={({ pressed }) => [styles.back, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
              <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={18} tintColor={theme.text} />
            </Tap>
          ) : null}
          <View style={styles.titles}>
            {subtitle ? (
              <ThemedText type="eyebrow" themeColor="textSecondary" numberOfLines={1}>
                {subtitle}
              </ThemedText>
            ) : null}
            <ThemedText type="display" numberOfLines={titleLines}>
              {title}
            </ThemedText>
          </View>
          {action}
        </View>
      </View>
      <PageEnter style={[styles.content, wide && styles.wide, style]}>{children}</PageEnter>
    </View>
  );
}

export function SectionTitle({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {children}
      </ThemedText>
      {trailing}
    </View>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <ThemedText themeColor="textSecondary" style={styles.empty}>
      {children}
    </ThemedText>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.error, { backgroundColor: theme.dangerSoft }]}>
      <ThemedText style={{ color: theme.danger, flex: 1 }}>{message}</ThemedText>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: theme.danger }}>
            Retry
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    minHeight: 44,
  },
  wide: { maxWidth: 1280 },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: Spacing.half },
  content: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
    minHeight: 36,
  },
  empty: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, lineHeight: 22 },
  loading: { padding: Spacing.five, alignItems: 'center' },
  error: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  card: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three + Spacing.one,
    borderRadius: Radius.large,
    gap: Spacing.two,
    ...Platform.select({ web: { cursor: 'default' } as object }),
  },
});
