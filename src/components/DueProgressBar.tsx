import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Item } from '../types/Item';
import { getDueProgress, getStatus } from '../utils/dateCalculations';
import { useTheme } from '../theme/ThemeContext';

/**
 * A thin bar showing how much of the item's replacement interval has elapsed,
 * tinted by urgency (green → amber → red). Overdue items read as a full red bar.
 */
export default function DueProgressBar({ item }: { item: Item }) {
  const { colors } = useTheme();
  const progress = getDueProgress(item);
  const statusColor = {
    overdue: colors.overdue,
    dueSoon: colors.dueSoon,
    ok: colors.ok,
  } as const;
  const color = statusColor[getStatus(item)];
  return (
    <View style={[styles.track, { backgroundColor: colors.border }]} accessible accessibilityRole="progressbar">
      <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
