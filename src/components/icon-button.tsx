import { SymbolView, type SFSymbol, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MaterialSymbol = NonNullable<Extract<SymbolViewProps['name'], object>['android']>;

type Props = {
  /** SF Symbol name for iOS. */
  ios: SFSymbol;
  /** Material Symbols name for Android and web. */
  material: MaterialSymbol;
  label: string;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  /** Filled accent background instead of a quiet one. */
  primary?: boolean;
  /** Pulsing danger background, used for "listening" and "stop". */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  ios,
  material,
  label,
  onPress,
  size = 40,
  disabled,
  primary,
  active,
  style,
}: Props) {
  const theme = useTheme();
  const background = active
    ? theme.danger
    : primary
      ? theme.accent
      : theme.backgroundElement;
  const tint = active || primary ? theme.textOnAccent : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}>
      <SymbolView
        name={{ ios, android: material, web: material }}
        size={Math.round(size * 0.5)}
        tintColor={tint}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
