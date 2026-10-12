export interface Palette {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  primaryLight: string;
  overdue: string; // text/icon color for overdue; readable on `card` and `overdueBg`
  overdueBg: string;
  dueSoon: string;
  dueSoonBg: string;
  ok: string;
  okBg: string;
  danger: string;
  white: string;
  // Ring segments and progress fills: brighter than the text colors above.
  ringOverdue: string;
  ringDueSoon: string;
  ringOk: string;
  track: string; // empty part of rings and bars
}

export const lightColors: Palette = {
  background: '#F6F5FB',
  card: '#FFFFFF',
  text: '#1E1B3A',
  textSecondary: '#5E5A7A',
  border: '#E6E4F2',
  primary: '#4F46E5',
  primaryLight: '#E6E4FD',
  overdue: '#B4401A',
  overdueBg: '#FDE8E1',
  dueSoon: '#8A5A00',
  dueSoonBg: '#FDF0D5',
  ok: '#15803D',
  okBg: '#DCFCE7',
  danger: '#B4401A',
  white: '#FFFFFF',
  ringOverdue: '#E5532D',
  ringDueSoon: '#E0A21B',
  ringOk: '#15803D',
  track: '#ECEBF7',
};

export const darkColors: Palette = {
  background: '#0B0C0E',
  card: '#17191D',
  text: '#F2F3F5',
  textSecondary: '#A3A8B2',
  border: '#26292F',
  primary: '#6366F1',
  primaryLight: '#25264A',
  overdue: '#FF8A63',
  overdueBg: '#3A1A10',
  dueSoon: '#FFC53D',
  dueSoonBg: '#2A2310',
  ok: '#3DDC97',
  okBg: '#13261E',
  danger: '#FF8A63',
  white: '#FFFFFF',
  ringOverdue: '#FF6B3D',
  ringDueSoon: '#FFC53D',
  ringOk: '#3DDC97',
  track: '#23262C',
};

/**
 * Default (light) palette. Kept as a named export so theme-agnostic modules and
 * any not-yet-converted code keep compiling; screens/components should read the
 * active palette from `useTheme()` instead so they respond to dark mode.
 */
export const colors = lightColors;
