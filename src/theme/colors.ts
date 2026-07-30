export interface Palette {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  primaryLight: string;
  overdue: string;
  overdueBg: string;
  dueSoon: string;
  dueSoonBg: string;
  ok: string;
  okBg: string;
  danger: string;
  white: string;
}

export const lightColors: Palette = {
  background: '#F7F8FA',
  card: '#FFFFFF',
  text: '#1A1D21',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  overdue: '#DC2626',
  overdueBg: '#FEE2E2',
  dueSoon: '#D97706',
  dueSoonBg: '#FEF3C7',
  ok: '#16A34A',
  okBg: '#DCFCE7',
  danger: '#DC2626',
  white: '#FFFFFF',
};

export const darkColors: Palette = {
  background: '#0F1115',
  card: '#1A1D23',
  text: '#F3F4F6',
  textSecondary: '#9CA3AF',
  border: '#2C313A',
  primary: '#3B82F6',
  primaryLight: '#1E3A5F',
  overdue: '#F87171',
  overdueBg: '#3A1D1D',
  dueSoon: '#FBBF24',
  dueSoonBg: '#3A2E12',
  ok: '#34D399',
  okBg: '#123527',
  danger: '#F87171',
  white: '#FFFFFF',
};

/**
 * Default (light) palette. Kept as a named export so theme-agnostic modules and
 * any not-yet-converted code keep compiling; screens/components should read the
 * active palette from `useTheme()` instead so they respond to dark mode.
 */
export const colors = lightColors;
