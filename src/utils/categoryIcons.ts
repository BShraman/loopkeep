import { Ionicons } from '@expo/vector-icons';
import { Category } from '../types/Item';

export const categoryIcons: Record<Category, keyof typeof Ionicons.glyphMap> = {
  HVAC: 'thermometer-outline',
  Kitchen: 'restaurant-outline',
  Safety: 'shield-checkmark-outline',
  Plumbing: 'water-outline',
  Other: 'construct-outline',
};

/**
 * Per-category hue. Distinct from each other and from the status colors so a
 * category reads as a category, not a state. These saturated hues sit fine on
 * both light and dark cards; the soft circle behind an icon is derived from the
 * hue at render via `categoryTint` so it works in either theme.
 */
export const categoryColors: Record<Category, string> = {
  HVAC: '#EA580C', // orange
  Kitchen: '#0D9488', // teal
  Safety: '#DC2626', // red
  Plumbing: '#2563EB', // blue
  Other: '#7C3AED', // violet
};

/** A translucent version of a category hue for icon-circle backgrounds. */
export function categoryTint(hex: string, dark: boolean): string {
  return hex + (dark ? '33' : '1F'); // 20% / 12% alpha
}
