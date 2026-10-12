import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Item } from '../types/Item';
import { categoryIcons } from '../utils/categoryIcons';
import { getDueProgress } from '../utils/dateCalculations';
import { shortDue, statusOn } from '../utils/dashboard';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';

const SIZE = 48;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

interface Props {
  item: Item;
  today: Date;
  onPress: () => void;
}

/** Half-width tile: category icon inside a ring showing how much of the item's life is used. */
export default function ComingUpTile({ item, today, onPress }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const status = statusOn(item, today);
  const used = getDueProgress(item);
  const tone = {
    overdue: { ring: colors.ringOverdue, text: colors.overdue, bg: colors.overdueBg },
    dueSoon: { ring: colors.ringDueSoon, text: colors.dueSoon, bg: colors.dueSoonBg },
    ok: { ring: colors.ringOk, text: colors.textSecondary, bg: colors.okBg },
  }[status];
  const due = shortDue(item, today);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        status === 'overdue' && { borderColor: colors.ringOverdue },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${due}, ${Math.round(used * 100)}% of its life used`}
    >
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.track} strokeWidth={STROKE} fill="none" />
          {used > 0 && (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={tone.ring}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${used * C} ${C}`}
              fill="none"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          )}
        </Svg>
        <View style={[styles.icon, { backgroundColor: tone.bg }]}>
          <Ionicons name={categoryIcons[item.category]} size={18} color={tone.ring} />
        </View>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={[styles.due, { color: tone.text }]}>{due}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    tile: {
      flexBasis: '47%',
      flexGrow: 1,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: 'transparent',
      padding: 14,
      gap: 8,
    },
    pressed: {
      opacity: 0.75,
    },
    ring: {
      width: SIZE,
      height: SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      position: 'absolute',
      width: SIZE - STROKE * 2 - 6,
      height: SIZE - STROKE * 2 - 6,
      borderRadius: SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      minHeight: 40,
    },
    due: {
      fontSize: 13,
      fontWeight: '700',
    },
  });
