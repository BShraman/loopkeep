import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Item } from '../types/Item';
import { useTheme } from '../theme/ThemeContext';
import { todayISO } from '../utils/dateCalculations';
import { isSnoozed, needsRestock, snoozeLabel } from '../utils/itemExtras';

/** Small "Snoozed until …" / "No spares left" lines on item cards; nothing when neither applies. */
export default function ItemFlags({ item }: { item: Item }) {
  const { colors } = useTheme();
  const snoozed = isSnoozed(item, todayISO());
  const restock = needsRestock(item);
  if (!snoozed && !restock) return null;
  return (
    <View style={styles.wrap}>
      {snoozed && (
        <View style={styles.row}>
          <Ionicons name="alarm-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            {snoozeLabel(item.snoozedUntil as string)}
          </Text>
        </View>
      )}
      {restock && (
        <View style={styles.row}>
          <Ionicons name="cart-outline" size={12} color={colors.dueSoon} />
          <Text style={[styles.text, { color: colors.dueSoon }]}>No spares left</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 2,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    fontSize: 13,
  },
});
