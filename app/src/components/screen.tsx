import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Page frame: safe-area header with title, optional back button and action, content centred at MaxContentWidth. */
export function Screen({ title, subtitle, action, back, children, style }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerInner}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={({ pressed }) => [styles.back, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
              <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={18} tintColor={theme.text} />
            </Pressable>
          ) : null}
          <View style={styles.titles}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {action}
        </View>
      </View>
      <View style={[styles.content, style]}>{children}</View>
    </View>
  );
}

export function SectionTitle({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitleText}>
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
      <ThemedText style={{ color: theme.danger }}>{message}</ThemedText>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button">
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
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
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: Spacing.half },
  title: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  content: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
  },
  sectionTitleText: { textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 12 },
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
    padding: Spacing.three,
    borderRadius: Radius.medium,
    gap: Spacing.two,
    ...Platform.select({ web: { cursor: 'default' } as object }),
  },
});
