import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { HomeScreenProps } from '../navigation/RootNavigator';
import { getAllItems, getAllPricedHistory } from '../db/itemsRepository';
import { getCurrencyCode } from '../services/priceSettings';
import { Item, ReplacementHistory } from '../types/Item';
import { todayISO } from '../utils/dateCalculations';
import { isSnoozed, needsRestock } from '../utils/itemExtras';
import { snoozeItem } from '../notifications/notificationService';
import { lastPriceByItem } from '../utils/priceTrends';
import { dashboardHeadline, HeadlineTone, ringCounts, sortByUrgency, statusOn, weekStrip } from '../utils/dashboard';
import { useMarkReplaced } from '../hooks/useMarkReplaced';
import ComingUpTile from '../components/ComingUpTile';
import HealthRingCard from '../components/HealthRingCard';
import ItemCard from '../components/ItemCard';
import NextUpCard from '../components/NextUpCard';
import RestockRow from '../components/RestockRow';
import SnoozeSheet from '../components/SnoozeSheet';
import WeekStrip from '../components/WeekStrip';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';

const MIN_COMING_UP = 4;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [pricedHistory, setPricedHistory] = useState<ReplacementHistory[]>([]);
  const [currency, setCurrency] = useState('');
  const { markReplacedWithPrice, priceSheet } = useMarkReplaced();
  const [snoozeTarget, setSnoozeTarget] = useState<Item | null>(null);

  const loadItems = useCallback(async () => {
    const [loadedItems, history, code] = await Promise.all([
      getAllItems(),
      getAllPricedHistory(),
      getCurrencyCode(),
    ]);
    setItems(loadedItems);
    setPricedHistory(history);
    setCurrency(code);
    setLoaded(true);
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
    async (item: Item) => {
      // Refresh once now so the card moves on, and again after the price sheet closes.
      await markReplacedWithPrice(item, loadItems);
      await loadItems();
    },
    [loadItems, markReplacedWithPrice]
  );

  const handleSnooze = useCallback(
    async (days: number | null) => {
      const target = snoozeTarget;
      setSnoozeTarget(null);
      if (!target) return;
      await snoozeItem(target.id, days);
      await loadItems();
    },
    [loadItems, snoozeTarget]
  );

  const lastPrices = useMemo(() => lastPriceByItem(pricedHistory), [pricedHistory]);

  const view = useMemo(() => {
    const today = new Date();
    const todayIso = todayISO();
    const sorted = sortByUrgency(items, today);
    const needsAttention = sorted.filter((i) => statusOn(i, today) !== 'ok');
    // Snoozed items stay in the list but never take the Next up spot.
    const hero = needsAttention.find((i) => !isSnoozed(i, todayIso)) ?? null;
    const overdueCount = needsAttention.filter((i) => statusOn(i, today) === 'overdue').length;
    const heroOverdue = hero != null && statusOn(hero, today) === 'overdue';
    const rest = sorted.filter((i) => i !== hero);
    const attentionLeft = needsAttention.filter((i) => i !== hero).length;
    const comingUp = rest.slice(0, Math.max(MIN_COMING_UP, attentionLeft));
    return {
      today,
      headline: dashboardHeadline(items, today),
      counts: ringCounts(items, today),
      week: weekStrip(items, today),
      hero,
      moreOverdue: overdueCount - (heroOverdue ? 1 : 0),
      comingUp,
      later: rest.slice(comingUp.length),
      restock: sorted.filter(needsRestock),
    };
  }, [items]);

  const toneColor: Record<HeadlineTone, string> = {
    overdue: colors.overdue,
    dueSoon: colors.dueSoon,
    ok: colors.ok,
    neutral: colors.textSecondary,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.dateLine}>{format(view.today, 'EEEE, MMMM d')}</Text>
            {loaded && (
              <>
                <Text style={styles.headline} accessibilityRole="header">
                  {view.headline.title}
                </Text>
                <Text style={[styles.detail, { color: toneColor[view.headline.tone] }]}>
                  {view.headline.detail}
                </Text>
              </>
            )}
          </View>
          {Platform.OS !== 'web' && (
            <Pressable
              onPress={() => navigation.navigate('Scan', { mode: 'find' })}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Scan a barcode"
            >
              <Ionicons name="barcode-outline" size={22} color={colors.text} />
            </Pressable>
          )}
        </View>

        {loaded && items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="home-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Tap + to add a filter, battery or anything you replace.</Text>
          </View>
        ) : items.length > 0 ? (
          <>
            <WeekStrip days={view.week} onPressDay={() => navigation.navigate('Calendar')} />

            <HealthRingCard counts={view.counts} />

            {view.hero && (
              <>
                <Text style={styles.sectionLabel}>Next up</Text>
                <NextUpCard
                  item={view.hero}
                  moreOverdue={view.moreOverdue}
                  onPress={() => openItem(view.hero!.id)}
                  onMarkReplaced={() => handleMarkReplaced(view.hero!)}
                  onSnooze={() => setSnoozeTarget(view.hero)}
                  lastPrice={lastPrices.get(view.hero.id)}
                  currency={currency}
                />
              </>
            )}

            {view.comingUp.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Coming up</Text>
                <View style={styles.grid}>
                  {view.comingUp.map((item) => (
                    <ComingUpTile
                      key={item.id}
                      item={item}
                      today={view.today}
                      onPress={() => openItem(item.id)}
                    />
                  ))}
                </View>
              </>
            )}

            {view.restock.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Buy spares</Text>
                {view.restock.map((item) => (
                  <RestockRow
                    key={item.id}
                    item={item}
                    lastPrice={lastPrices.get(item.id)}
                    currency={currency}
                    onPress={() => openItem(item.id)}
                  />
                ))}
              </>
            )}

            {view.later.length > 0 && (
              <>
                <Pressable
                  style={styles.collapseHeader}
                  onPress={() => setShowLater((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showLater }}
                >
                  <Text style={styles.sectionLabel}>Later ({view.later.length})</Text>
                  <Ionicons
                    name={showLater ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
                {showLater &&
                  view.later.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onPress={() => openItem(item.id)}
                      lastPrice={lastPrices.get(item.id)}
                      currency={currency}
                    />
                  ))}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
      {priceSheet}
      <SnoozeSheet
        visible={snoozeTarget != null}
        itemName={snoozeTarget?.name ?? ''}
        snoozed={snoozeTarget ? isSnoozed(snoozeTarget, todayISO()) : false}
        onPick={handleSnooze}
        onDismiss={() => setSnoozeTarget(null)}
      />
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
      padding: 20,
      paddingBottom: 40,
      gap: 14,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 4,
    },
    headerText: {
      flex: 1,
    },
    dateLine: {
      ...typography.label,
      color: colors.textSecondary,
    },
    headline: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: 4,
      lineHeight: 30,
    },
    detail: {
      fontSize: 15,
      fontWeight: '600',
      marginTop: 4,
    },
    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginTop: 6,
      marginBottom: -4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    collapseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    empty: {
      alignItems: 'center',
      marginTop: 60,
      gap: 12,
    },
    emptyText: {
      ...typography.bodySecondary,
      textAlign: 'center',
    },
  });
};
