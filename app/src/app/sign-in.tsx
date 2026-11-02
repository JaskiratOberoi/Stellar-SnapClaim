import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';
import { Reveal } from '@/motion/reveal';
import { SnapMark } from '@/motion/snap-mark';
import { API_URL, describeError } from '@/services/api';

export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.five }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <SnapMark size={76} />
          <Reveal delay={240} y={10}>
            <ThemedText type="displayLarge" style={styles.brand}>SnapClaim</ThemedText>
          </Reveal>
          <Reveal delay={340} y={8}>
            <ThemedText type="serifItalic" themeColor="textSecondary" style={styles.tagline}>
              Snap the bill. Clear the claim.
            </ThemedText>
          </Reveal>

          <Reveal delay={420} y={16} style={styles.form}>
            <Field
              label="Work email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              placeholder="you@company.com"
              onSubmitEditing={submit}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              placeholder="••••••••"
              onSubmitEditing={submit}
            />
            <Presence visible={error !== null} y={6}>
              <ThemedText type="small" style={[styles.error, { color: theme.danger, backgroundColor: theme.dangerSoft }]}>
                {error}
              </ThemedText>
            </Presence>
            <Button title="Sign in" onPress={submit} loading={busy} />
          </Reveal>

          <Reveal delay={560} y={0}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
              Ask your administrator for an account. Connected to {API_URL.replace(/^https?:\/\//, '')}.
            </ThemedText>
          </Reveal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  card: { width: '100%', maxWidth: 400, alignItems: 'center', gap: Spacing.two },
  brand: { marginTop: Spacing.three },
  tagline: { marginBottom: Spacing.four, fontSize: 19, lineHeight: 26 },
  form: { width: '100%', gap: Spacing.three },
  error: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 14, overflow: 'hidden' },
  footer: { textAlign: 'center', marginTop: Spacing.four, lineHeight: 20 },
});
