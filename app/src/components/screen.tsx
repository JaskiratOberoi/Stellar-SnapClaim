import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, SidebarWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PageEnter } from '@/motion/page-enter';
import { Tap } from '@/motion/tap';

type Props = {
  title: string;
  /** A muted line above the title: the date on the home screen. */
  eyebrow?: string;
  /** A muted line under the title: what the page is for. */
  subtitle?: string;
  action?: ReactNode;
  back?: boolean;
  /** The greeting takes the larger size. */
  large?: boolean;
  /** The whole page scrolls, header included, with room under the content for the nav. */
  scroll?: boolean;
  /** Extra space under the content, for a floating bar. */
  bottomSpace?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Page frame. On phones a top bar carries the wordmark (or a back button) and
 * the action; on wide windows the sidebar holds the wordmark, so the header is
 * just the serif title with its lines. Content is centred at MaxContentWidth.
 */
export function Screen({ title, eyebrow, subtitle, action, back, large, scroll, bottomSpace = 0, children, style }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sidebar = useWindowDimensions().width >= SidebarWidth;
  const topBar = !sidebar || back;
  const body = (
    <>
      <View style={styles.header}>
        <View style={styles.inner}>
          {topBar ? (
            <View style={styles.topBar}>
              {back ? (
                <Tap
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  hitSlop={8}
                  scale={0.9}
                  onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                  style={({ pressed }) => [styles.back, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
                  <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={18} tintColor={theme.text} />
                </Tap>
              ) : (
                <ThemedText type="serif" style={styles.wordmark}>
                  SnapClaim
                </ThemedText>
              )}
              <View style={styles.spacer} />
              {action}
            </View>
          ) : null}
          <View style={styles.titleRow}>
            <View style={styles.titles}>
              {eyebrow ? (
                <ThemedText themeColor="textMuted" numberOfLines={1}>
                  {eyebrow}
                </ThemedText>
              ) : null}
              <ThemedText type={large ? 'displayLarge' : 'display'} numberOfLines={2}>
                {title}
              </ThemedText>
              {subtitle ? (
                <ThemedText themeColor="textMuted" style={styles.subtitle}>
                  {subtitle}
                </ThemedText>
              ) : null}
            </View>
            {!topBar ? action : null}
          </View>
        </View>
      </View>
      <PageEnter style={[styles.content, style]}>{children}</PageEnter>
    </>
  );
  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 + bottomSpace }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
}

export function SectionTitle({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText type="serif">{children}</ThemedText>
      {trailing}
    </View>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <ThemedText themeColor="textMuted" style={styles.empty}>
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
          <ThemedText type="smallSemi" style={{ color: theme.danger }}>
            Retry
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A plain surface card: lighter than the ground, a hairline border, the medium radius. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: Spacing.two },
  wordmark: { fontSize: 24, lineHeight: 30 },
  spacer: { flex: 1 },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  titles: { flex: 1, gap: Spacing.one },
  subtitle: { lineHeight: 24 },
  content: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.two,
  },
  empty: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, lineHeight: 24 },
  loading: { padding: Spacing.five, alignItems: 'center' },
  error: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.small,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  card: {
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    gap: Spacing.two,
    ...Platform.select({ web: { cursor: 'default' } as object }),
  },
});
