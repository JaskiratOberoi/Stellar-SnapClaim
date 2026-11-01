import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
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
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.five }]} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={[styles.mark, { backgroundColor: theme.accent }]}>
            <ThemedText style={[styles.markText, { color: theme.textOnAccent }]}>S</ThemedText>
          </View>
          <ThemedText style={styles.brand}>SnapClaim</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tagline}>
            Snap the bill. Clear the claim.
          </ThemedText>

          <View style={styles.form}>
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
              error={error}
            />
            <Button title="Sign in" onPress={submit} loading={busy} />
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            Ask your administrator for an account. Connected to {API_URL.replace(/^https?:\/\//, '')}.
          </ThemedText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', gap: Spacing.two },
  mark: { width: 64, height: 64, borderRadius: Radius.large, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  markText: { fontSize: 34, fontWeight: 800, lineHeight: 40 },
  brand: { fontSize: 32, lineHeight: 38, fontWeight: 800, letterSpacing: -0.5 },
  tagline: { marginBottom: Spacing.four },
  form: { width: '100%', gap: Spacing.three },
  footer: { textAlign: 'center', marginTop: Spacing.four, lineHeight: 20 },
});
