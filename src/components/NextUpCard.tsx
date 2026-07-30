import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Item, ItemStatus } from '../types/Item';
import { dueSummary, getStatus } from '../utils/dateCalculations';
import { categoryIcons } from '../utils/categoryIcons';
import StatusBadge from './StatusBadge';
import DueProgressBar from './DueProgressBar';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';

interface Props {
  item: Item;
  onPress: () => void;
  onMarkReplaced: () => void;
}

export default function NextUpCard({ item, onPress, onMarkReplaced }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const accent: Record<ItemStatus, { border: string; iconBg: string; icon: string; text: string }> = {
    overdue: { border: colors.overdue, iconBg: colors.overdueBg, icon: colors.overdue, text: colors.overdue },
    dueSoon: { border: colors.dueSoon, iconBg: colors.dueSoonBg, icon: colors.dueSoon, text: colors.dueSoon },
    ok: { border: colors.border, iconBg: colors.okBg, icon: colors.ok, text: colors.ok },
  };
  const status = getStatus(item);
  const theme = accent[status];
  return (
    <Pressable onPress={onPress} style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: theme.iconBg }]}>
          <Ionicons name={categoryIcons[item.category]} size={24} color={theme.icon} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.due, { color: theme.text }]}>{dueSummary(item)}</Text>
        </View>
        <StatusBadge status={status} />
      </View>
      <View style={styles.progress}>
        <DueProgressBar item={item} />
      </View>
      <Pressable
        onPress={onMarkReplaced}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color={colors.text} />
        <Text style={styles.buttonText}>Mark replaced today</Text>
      </Pressable>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 2,
      padding: 14,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
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
      fontWeight: '500',
      marginTop: 2,
    },
    progress: {
      marginTop: 12,
    },
    button: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonPressed: {
      backgroundColor: colors.background,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
  });
