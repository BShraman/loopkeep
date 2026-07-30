import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { getSetting, setSetting } from '../db/database';
import { Palette, darkColors, lightColors } from './colors';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

const PREFERENCE_KEY = 'themePreference';

interface ThemeContextValue {
  colors: Palette;
  scheme: ResolvedScheme; // the palette actually in effect
  preference: ThemePreference; // what the user chose
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolve(preference: ThemePreference, system: ColorSchemeName): ResolvedScheme {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  // Load the saved preference once.
  useEffect(() => {
    getSetting(PREFERENCE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setPreferenceState(saved);
      }
    });
  }, []);

  // Track OS light/dark changes (only matters while preference is 'system').
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    return () => sub.remove();
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    void setSetting(PREFERENCE_KEY, p);
  }, []);

  const scheme = resolve(preference, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/**
 * Build a themed StyleSheet in render. Pass a factory that maps the active
 * palette to styles; it's re-run only when the palette changes.
 *
 *   const makeStyles = (c: Palette) => StyleSheet.create({ box: { backgroundColor: c.card } });
 *   const { colors, styles } = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T>(factory: (colors: Palette) => T): { colors: Palette; styles: T } {
  const { colors } = useTheme();
  const styles = useMemo(() => factory(colors), [colors, factory]);
  return { colors, styles };
}
