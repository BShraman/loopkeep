import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Item } from '../types/Item';
import { dueSummary, formatDueDate, getStatus } from '../utils/dateCalculations';
import { categoryColors, categoryIcons, categoryTint } from '../utils/categoryIcons';
import StatusBadge from './StatusBadge';
import DueProgressBar from './DueProgressBar';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';

interface Props {
  item: Item;
  onPress: () => void;
}

export default function ItemCard({ item, onPress }: Props) {
  const { colors, scheme } = useTheme();
  const styles = makeStyles(colors);
  const status = getStatus(item);
  const hue = categoryColors[item.category];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: categoryTint(hue, scheme === 'dark') }]}>
          <Ionicons name={categoryIcons[item.category]} size={22} color={hue} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.due}>
            {dueSummary(item)} · {formatDueDate(item)}
          </Text>
        </View>
        <StatusBadge status={status} />
      </View>
      <DueProgressBar item={item} />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    pressed: {
      opacity: 0.7,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    due: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
