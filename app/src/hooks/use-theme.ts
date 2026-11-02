import { Palette } from '@/constants/theme';

/** SnapClaim ships one light world; the hook stays so components read colours from one place. */
export function useTheme() {
  return Palette;
}
