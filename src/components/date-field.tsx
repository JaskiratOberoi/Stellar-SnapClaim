import * as chrono from 'chrono-node';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatWhen, startOfDay } from '@/services/format';

type Props = {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Offer time-of-day chips and keep the time component. */
  withTime?: boolean;
  placeholder?: string;
};

/**
 * Natural-language date entry: type "tomorrow 5pm" or "next friday", or tap a
 * chip. Avoids a native picker so it behaves the same on every platform.
 */
export function DateField({ label, value, onChange, withTime, placeholder }: Props) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const result = chrono.parse(trimmed, new Date(), { forwardDate: true })[0];
    if (!result) {
      setError(`Couldn't read "${trimmed}" as a date.`);
      return;
    }
    const date = result.start.date();
    if (!withTime || !result.start.isCertain('hour')) {
      if (withTime && !result.start.isCertain('hour')) date.setHours(9, 0, 0, 0);
      else date.setHours(0, 0, 0, 0);
    }
    onChange(date.getTime());
    setText('');
    setError(null);
  };

  const today = startOfDay(useNow());
  const setDay = (dayStart: number) => {
    if (withTime) {
      const hour = value ? new Date(value).getHours() : 9;
      const minute = value ? new Date(value).getMinutes() : 0;
      onChange(dayStart + hour * 3600000 + minute * 60000);
    } else {
      onChange(dayStart);
    }
  };
  const setHour = (hour: number) => {
    const base = value ? startOfDay(value) : today;
    const candidate = base + hour * 3600000;
    onChange(candidate < Date.now() && base === today ? candidate + 24 * 3600000 : candidate);
  };

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="smallBold" style={{ color: value ? theme.accent : theme.textSecondary }}>
          {value ? formatWhen(value) : 'Not set'}
        </ThemedText>
      </View>
      <View style={styles.chips}>
        <Chip small label="Today" selected={value !== undefined && startOfDay(value) === today} onPress={() => setDay(today)} />
        <Chip small label="Tomorrow" selected={value !== undefined && startOfDay(value) === addDays(today, 1)} onPress={() => setDay(addDays(today, 1))} />
        <Chip small label="Next week" onPress={() => setDay(addDays(today, 7))} />
        {withTime ? (
          <>
            <Chip small label="9 am" onPress={() => setHour(9)} />
            <Chip small label="2 pm" onPress={() => setHour(14)} />
            <Chip small label="6 pm" onPress={() => setHour(18)} />
          </>
        ) : null}
        {value !== undefined ? <Chip small label="Clear" onPress={() => onChange(undefined)} /> : null}
      </View>
      <TextInput
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: error ? theme.danger : theme.border, fontFamily: Fonts.sans },
        ]}
        value={text}
        onChangeText={(next) => {
          setText(next);
          setError(null);
        }}
        onSubmitEditing={apply}
        onBlur={apply}
        placeholder={placeholder ?? (withTime ? 'e.g. tomorrow 5pm, next friday 10am' : 'e.g. next monday, 15 Nov')}
        placeholderTextColor={theme.textSecondary}
        returnKeyType="done"
        accessibilityLabel={`${label} as text`}
      />
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + Spacing.half,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
});
