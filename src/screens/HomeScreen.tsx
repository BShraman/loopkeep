import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreenProps } from '../navigation/RootNavigator';
import { getAllItems, getItemById, markReplaced } from '../db/itemsRepository';
import { rescheduleReminderForItem } from '../notifications/notificationService';
import { Item } from '../types/Item';
import { getDaysUntilDue, getStatus, todayISO } from '../utils/dateCalculations';
import ItemCard from '../components/ItemCard';
import NextUpCard from '../components/NextUpCard';
import SummaryStat from '../components/SummaryStat';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [items, setItems] = useState<Item[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showOnTrack, setShowOnTrack] = useState(false);

  const loadItems = useCallback(async () => {
    setItems(await getAllItems());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  }, [loadItems]);

  const openItem = useCallback(
    (id: string) => navigation.navigate('ItemDetail', { itemId: id }),
    [navigation]
  );

  const handleMarkReplaced = useCallback(
    async (id: string) => {
      await markReplaced(id, todayISO());
      const updated = await getItemById(id);
      if (updated) await rescheduleReminderForItem(updated);
      await loadItems();
    },
    [loadItems]
  );

  const { counts, hero, attention, onTrack } = useMemo(() => {
    const sorted = [...items].sort((a, b) => getDaysUntilDue(a) - getDaysUntilDue(b));
    const overdue = sorted.filter((i) => getStatus(i) === 'overdue');
    const dueSoon = sorted.filter((i) => getStatus(i) === 'dueSoon');
    const ok = sorted.filter((i) => getStatus(i) === 'ok');

    const needsAttention = [...overdue, ...dueSoon];
    const heroItem = needsAttention[0] ?? null;

    return {
      counts: { overdue: overdue.length, dueSoon: dueSoon.length, ok: ok.length },
      hero: heroItem,
      attention: heroItem ? needsAttention.slice(1) : [],
      onTrack: ok,
    };
  }, [items]);

  const allClear = items.length > 0 && !hero;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Home health</Text>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Backup and restore"
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="home-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No items yet. Tap + to add one.</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <SummaryStat status="overdue" count={counts.overdue} />
              <SummaryStat status="dueSoon" count={counts.dueSoon} />
              <SummaryStat status="ok" count={counts.ok} />
            </View>

            {hero && (
              <>
                <Text style={styles.sectionLabel}>Next up</Text>
                <NextUpCard
                  item={hero}
                  onPress={() => openItem(hero.id)}
                  onMarkReplaced={() => handleMarkReplaced(hero.id)}
                />
              </>
            )}

            {allClear && (
              <View style={styles.allClear}>
                <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.ok} />
                <Text style={styles.allClearText}>All caught up — nothing due right now.</Text>
              </View>
            )}

            {attention.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Needs attention</Text>
                {attention.map((item) => (
                  <ItemCard key={item.id} item={item} onPress={() => openItem(item.id)} />
                ))}
              </>
            )}

            {onTrack.length > 0 && (
              <>
                <Pressable
                  style={styles.collapseHeader}
                  onPress={() => setShowOnTrack((v) => !v)}
                >
                  <Text style={styles.sectionLabel}>On track ({onTrack.length})</Text>
                  <Ionicons
                    name={showOnTrack ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
                {showOnTrack &&
                  onTrack.map((item) => (
                    <ItemCard key={item.id} item={item} onPress={() => openItem(item.id)} />
                  ))}
              </>
            )}
          </>
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
    paddingBottom: 96,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heading: {
    ...typography.title,
    fontSize: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 10,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  allClear: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  allClearText: {
    ...typography.bodySecondary,
    textAlign: 'center',
  },
  empty: {
    alignItems: 'center',
    marginTop: 80,
    gap: 12,
  },
  emptyText: {
    ...typography.bodySecondary,
  },
  });
};
