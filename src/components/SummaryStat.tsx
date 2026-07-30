import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ItemStatus } from '../types/Item';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  status: ItemStatus;
  count: number;
}

export default function SummaryStat({ status, count }: Props) {
  const { colors } = useTheme();
  const config: Record<ItemStatus, { label: string; color: string; bg: string }> = {
    overdue: { label: 'Overdue', color: colors.overdue, bg: colors.overdueBg },
    dueSoon: { label: 'Due soon', color: colors.dueSoon, bg: colors.dueSoonBg },
    ok: { label: 'On track', color: colors.ok, bg: colors.okBg },
  };
  const { label, color, bg } = config[status];
  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Text style={[styles.count, { color }]}>{count}</Text>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
  },
  count: {
    fontSize: 24,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
