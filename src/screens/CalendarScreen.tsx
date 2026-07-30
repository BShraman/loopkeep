import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { CalendarScreenProps } from '../navigation/RootNavigator';
import { getAllItems } from '../db/itemsRepository';
import { Item } from '../types/Item';
import { getDueDate, toISODate } from '../utils/dateCalculations';
import { categoryColors } from '../utils/categoryIcons';
import ItemCard from '../components/ItemCard';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarScreen({ navigation }: CalendarScreenProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [items, setItems] = useState<Item[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(new Date());

  useFocusEffect(
    useCallback(() => {
      getAllItems().then(setItems);
    }, [])
  );

  // Map ISO due date -> items due that day.
  const dueByDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const key = toISODate(getDueDate(item));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const weeks = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(visibleMonth));
    const gridEnd = endOfWeek(endOfMonth(visibleMonth));
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const chunked: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      chunked.push(days.slice(i, i + 7));
    }
    return chunked;
  }, [visibleMonth]);

  const selectedItems = dueByDate.get(toISODate(selectedDate)) ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.monthHeader}>
          <Pressable
            hitSlop={12}
            onPress={() => setVisibleMonth((m) => subMonths(m, 1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.monthTitle}>{format(visibleMonth, 'MMMM yyyy')}</Text>
          <Pressable
            hitSlop={12}
            onPress={() => setVisibleMonth((m) => addMonths(m, 1))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day) => {
              const inMonth = isSameMonth(day, visibleMonth);
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const dueItems = dueByDate.get(toISODate(day)) ?? [];
              return (
                <Pressable
                  key={day.toISOString()}
                  style={styles.dayCell}
                  onPress={() => setSelectedDate(day)}
                >
                  <View style={[styles.dayInner, isSelected && styles.daySelected]}>
                    <Text
                      style={[
                        styles.dayNum,
                        !inMonth && styles.dayNumMuted,
                        isToday && !isSelected && styles.dayNumToday,
                        isSelected && styles.dayNumSelected,
                      ]}
                    >
                      {format(day, 'd')}
                    </Text>
                    <View style={styles.dotRow}>
                      {dueItems.slice(0, 3).map((item) => (
                        <View
                          key={item.id}
                          style={[
                            styles.dot,
                            {
                              backgroundColor: isSelected
                                ? colors.white
                                : categoryColors[item.category],
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <Text style={styles.selectedLabel}>{format(selectedDate, 'EEEE, MMM d')}</Text>
        {selectedItems.length === 0 ? (
          <Text style={styles.emptyText}>Nothing due on this day.</Text>
        ) : (
          selectedItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) => {
  const typography = makeTypography(colors);
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    ...typography.title,
    fontSize: 20,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: '92%',
    height: '92%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  dayNum: {
    fontSize: 15,
    color: colors.text,
  },
  dayNumMuted: {
    color: colors.border,
  },
  dayNumToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  dayNumSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  selectedLabel: {
    ...typography.heading,
    fontSize: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  emptyText: {
    ...typography.bodySecondary,
  },
  });
};
