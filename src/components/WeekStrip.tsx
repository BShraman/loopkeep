import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WeekDay } from '../utils/dashboard';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';

interface Props {
  days: WeekDay[];
  onPressDay?: (day: WeekDay) => void;
}

/** Today and the next 6 days; a dot marks days with something due. */
export default function WeekStrip({ days, onPressDay }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.row}>
      {days.map((d) => {
        const dot =
          d.marker === 'overdue' ? colors.ringOverdue : d.marker === 'due' ? colors.ringDueSoon : 'transparent';
        const label = `${d.weekday} ${d.dayOfMonth}${
          d.marker === 'overdue' ? ', overdue items' : d.dueCount > 0 ? `, ${d.dueCount} due` : ''
        }`;
        return (
          <Pressable
            key={d.iso}
            onPress={onPressDay ? () => onPressDay(d) : undefined}
            style={[styles.day, d.isToday && styles.today]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Text style={[styles.weekday, d.isToday && styles.todayText]}>{d.weekday}</Text>
            <Text style={[styles.date, d.isToday && styles.todayText]}>{d.dayOfMonth}</Text>
            <View style={[styles.dot, { backgroundColor: dot }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 4,
    },
    day: {
      flex: 1,
      height: 64,
      borderRadius: 14,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    today: {
      backgroundColor: colors.text,
    },
    weekday: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    date: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    todayText: {
      color: colors.background,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
  });
