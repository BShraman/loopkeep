import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Item } from '../types/Item';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { formatDueDate } from '../utils/dateCalculations';
import { reorderUrlFor } from '../utils/itemExtras';
import { formatMoney } from '../utils/money';

interface Props {
  item: Item;
  lastPrice?: number;
  currency: string;
  onPress: () => void;
}

/** Dashboard "Buy spares" row: what to buy, by when, and a Reorder button. */
export default function RestockRow({ item, lastPrice, currency, onPress }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Ionicons name="cart-outline" size={20} color={colors.dueSoon} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta}>
          Next due {formatDueDate(item)}
          {lastPrice != null && currency ? ` · last paid ${formatMoney(lastPrice, currency)}` : ''}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
        onPress={() => Linking.openURL(reorderUrlFor(item)).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={`Reorder ${item.name}`}
      >
        <Text style={styles.buttonText}>Reorder</Text>
      </Pressable>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    meta: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    buttonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
    },
  });
