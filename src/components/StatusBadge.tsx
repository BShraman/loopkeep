import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ItemStatus } from '../types/Item';
import { useTheme } from '../theme/ThemeContext';

export default function StatusBadge({ status }: { status: ItemStatus }) {
  const { colors } = useTheme();
  const config: Record<ItemStatus, { label: string; color: string; bg: string }> = {
    overdue: { label: 'Overdue', color: colors.overdue, bg: colors.overdueBg },
    dueSoon: { label: 'Due soon', color: colors.dueSoon, bg: colors.dueSoonBg },
    ok: { label: 'OK', color: colors.ok, bg: colors.okBg },
  };
  const { label, color, bg } = config[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
