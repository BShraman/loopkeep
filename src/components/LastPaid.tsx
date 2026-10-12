import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { formatMoney } from '../utils/money';

interface Props {
  price?: number; // cents
  currency: string;
}

/** "Last paid $24.99" line on item cards; renders nothing when no price is recorded. */
export default function LastPaid({ price, currency }: Props) {
  const { colors } = useTheme();
  if (price == null || !currency) return null;
  return (
    <View style={styles.row}>
      <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        Last paid {formatMoney(price, currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  text: {
    fontSize: 13,
  },
});
