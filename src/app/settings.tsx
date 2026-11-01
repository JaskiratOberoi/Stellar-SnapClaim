import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useSettings } from '@/hooks/use-settings';
import { useStore } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import type { ProviderPreference } from '@/services/assistant';
import { CLAUDE_MODEL } from '@/services/assistant/claude-assistant';
import { deleteConversation } from '@/services/storage/conversation-store';

const PROVIDER_OPTIONS: { value: ProviderPreference; label: string; hint: string }[] = [
  { value: 'auto', label: 'Automatic', hint: 'Claude when a key is saved, otherwise offline.' },
  { value: 'local', label: 'Offline', hint: 'Time, date and arithmetic only. Nothing leaves the device.' },
  { value: 'claude', label: 'Claude', hint: `Full conversations through ${CLAUDE_MODEL}.` },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, claudeApiKey, updateSettings, setClaudeApiKey } = useSettings();

  const [name, setName] = useState(settings.userName);
  const [language, setLanguage] = useState(settings.voiceLanguage);
  const [currency, setCurrency] = useState(settings.currency);
  const [keyDraft, setKeyDraft] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [wipeStage, setWipeStage] = useState<0 | 1 | 2>(0);
  const { tasks, expenses, clearEverything } = useStore();

  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.backgroundElement,
      borderColor: theme.border,
      fontFamily: Fonts.sans,
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.column}>
        <Section title="About you">
          <Field label="What should I call you?">
            <TextInput
              style={inputStyle}
              value={name}
              onChangeText={setName}
              onBlur={() => void updateSettings({ userName: name.trim() })}
              placeholder="Your name"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              accessibilityLabel="Your name"
            />
          </Field>
        </Section>

        <Section title="Assistant">
          <View style={styles.optionList}>
            {PROVIDER_OPTIONS.map((option) => {
              const selected = settings.provider === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => void updateSettings({ provider: option.value })}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}>
                  <ThemedText type="smallBold">{option.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {option.hint}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Field
            label="Claude API key"
            hint={
              claudeApiKey
                ? `A key ending in …${claudeApiKey.slice(-4)} is saved on this device.`
                : 'Stored only on this device. Get one from console.anthropic.com.'
            }>
            <View style={styles.keyRow}>
              <TextInput
                style={[inputStyle, styles.keyInput]}
                value={keyDraft}
                onChangeText={(text) => {
                  setKeyDraft(text);
                  setKeySaved(false);
                }}
                placeholder={claudeApiKey ? 'Paste a new key to replace it' : 'sk-ant-…'}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Claude API key"
              />
              <Button
                label={keySaved ? 'Saved' : 'Save'}
                disabled={!keyDraft.trim()}
                onPress={async () => {
                  await setClaudeApiKey(keyDraft);
                  setKeyDraft('');
                  setKeySaved(true);
                }}
              />
            </View>
            {claudeApiKey ? (
              <Button
                label="Remove saved key"
                tone="danger"
                onPress={async () => {
                  await setClaudeApiKey(null);
                  setKeySaved(false);
                }}
              />
            ) : null}
          </Field>
        </Section>

        <Section title="Voice">
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <ThemedText>Read replies aloud</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Uses the device&apos;s own voices.
              </ThemedText>
            </View>
            <Switch
              value={settings.speakReplies}
              onValueChange={(value) => void updateSettings({ speakReplies: value })}
              trackColor={{ true: theme.accent }}
              accessibilityLabel="Read replies aloud"
            />
          </View>
          <Field label="Voice language" hint="A BCP 47 tag such as en-US, en-IN or hi-IN.">
            <TextInput
              style={inputStyle}
              value={language}
              onChangeText={setLanguage}
              onBlur={() => void updateSettings({ voiceLanguage: language.trim() || 'en-US' })}
              placeholder="en-US"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Voice language"
            />
          </Field>
        </Section>

        <Section title="Expenses">
          <Field label="Currency" hint="ISO code such as INR, USD or EUR. Used when an expense does not name one.">
            <TextInput
              style={inputStyle}
              value={currency}
              onChangeText={(text) => setCurrency(text.toUpperCase())}
              onBlur={() =>
                void updateSettings({ currency: /^[A-Z]{3}$/.test(currency.trim()) ? currency.trim() : 'INR' })
              }
              placeholder="INR"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={3}
              accessibilityLabel="Currency"
            />
          </Field>
        </Section>

        <Section title="Data">
          <ThemedText type="small" themeColor="textSecondary">
            {tasks.length} tasks and {expenses.length} expenses are stored on this device.
          </ThemedText>
          <Button
            label={cleared ? 'Conversation cleared' : 'Clear conversation'}
            tone="danger"
            disabled={cleared}
            onPress={async () => {
              await deleteConversation();
              setCleared(true);
            }}
          />
          <Button
            label={wipeStage === 2 ? 'Everything deleted' : wipeStage === 1 ? 'Tap again to delete all tasks and expenses' : 'Delete all tasks and expenses'}
            tone="danger"
            disabled={wipeStage === 2}
            onPress={async () => {
              if (wipeStage === 0) {
                setWipeStage(1);
                return;
              }
              await clearEverything();
              setWipeStage(2);
            }}
          />
        </Section>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="small">{label}</ThemedText>
      {children}
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  tone?: 'primary' | 'danger';
}) {
  const theme = useTheme();
  const background = tone === 'danger' ? theme.backgroundElement : theme.accent;
  const color = tone === 'danger' ? theme.danger : theme.textOnAccent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => void onPress()}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    letterSpacing: 0.8,
    fontSize: 12,
  },
  sectionBody: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one + Spacing.half,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  keyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  keyInput: {
    flex: 1,
  },
  optionList: {
    gap: Spacing.two,
  },
  option: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    gap: Spacing.half,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchLabel: {
    flex: 1,
    gap: Spacing.half,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Radius.pill,
  },
});
