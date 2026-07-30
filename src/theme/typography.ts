import { TextStyle } from 'react-native';
import { Palette, colors as defaultColors } from './colors';

export type Typography = Record<string, TextStyle>;

/** Build the type scale against a specific palette so text color follows the theme. */
export function makeTypography(colors: Palette): Typography {
  return {
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    heading: { fontSize: 20, fontWeight: '600', color: colors.text },
    body: { fontSize: 16, color: colors.text },
    bodySecondary: { fontSize: 14, color: colors.textSecondary },
    label: { fontSize: 14, fontWeight: '600', color: colors.text },
    caption: { fontSize: 12, color: colors.textSecondary },
  };
}

/** Light-palette type scale, for theme-agnostic/not-yet-converted usage. */
export const typography = makeTypography(defaultColors);
