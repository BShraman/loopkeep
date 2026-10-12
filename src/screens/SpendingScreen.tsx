import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { format, parseISO } from 'date-fns';
import { SpendingScreenProps } from '../navigation/RootNavigator';
import { getAllHistory, getAllItems } from '../db/itemsRepository';
import { getCurrencyCode } from '../services/priceSettings';
import { Item, ReplacementHistory } from '../types/Item';
import { categoryColors } from '../utils/categoryIcons';
import { formatMoney } from '../utils/money';
import { shortDue } from '../utils/dashboard';
import { COMING_UP_DAYS, SpendingRange, spendingAnalysis, spendingInsights } from '../utils/spendingAnalysis';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';

const RANGES: { key: SpendingRange; label: string }[] = [
  { key: 'year', label: 'This year' },
  { key: '12m', label: '12 months' },
  { key: 'all', label: 'All time' },
];
const RANGE_CAPTION: Record<SpendingRange, string> = {
  year: 'Jan 1 – today',
  '12m': 'last 12 months',
  all: 'all time',
};
const COMPARE_LABEL: Record<SpendingRange, string> = {
  year: 'vs. last year',
  '12m': 'vs. year before',
  all: 'vs. before',
};

const RING = 148;
const STROKE = 16;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;
const BAR_AREA = 110;
const COMING_UP_ROWS = 5;
const PRICE_CHANGE_ROWS = 3;

/** The Spending tab: totals, trend, what's coming and where the money goes. */
export default function SpendingScreen({ navigation }: SpendingScreenProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<ReplacementHistory[] | null>(null);
  const [currency, setCurrency] = useState('');
  const [range, setRange] = useState<SpendingRange>('year');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [loadedItems, allHistory, code] = await Promise.all([
          getAllItems(),
          getAllHistory(),
          getCurrencyCode(),
        ]);
        setItems(loadedItems);
        setHistory(allHistory);
        setCurrency(code);
      })();
    }, [])
  );

  // Re-read "today" on each load so the tab is right after midnight.
  const today = useMemo(() => new Date(), [history]);
  const a = useMemo(
    () => (history ? spendingAnalysis(items, history, today, range) : null),
    [items, history, today, range]
  );

  if (!a) return <SafeAreaView style={styles.container} edges={['top']} />;

  const money = (cents: number) => formatMoney(cents, currency);
  const compact = (cents: number) => formatMoney(cents, currency, true);
  const insights = spendingInsights(a, compact);
  const openItem = (id: string) => navigation.navigate('ItemDetail', { itemId: id });
  const anyPriced = history!.some((h) => h.price != null || h.labor != null);

  let ringOffset = 0;
  const arcs = a.byCategory.map((c) => {
    const len = c.share * C;
    const arc = { key: c.category, color: categoryColors[c.category], len, offset: -ringOffset };
    ringOffset += len;
    return arc;
  });
  const maxMonth = Math.max(...a.months.map((m) => m.total), 1);
  const avgBottom = (a.monthlyAverage / maxMonth) * BAR_AREA;
  const currentMonth = format(today, 'yyyy-MM');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Spending
        </Text>

        <View style={styles.segment} accessibilityRole="tablist">
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[styles.segmentItem, active && styles.segmentActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {!anyPriced ? (
          <View style={styles.card}>
            <Ionicons name="pricetag-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.cardTitle}>No prices yet</Text>
            <Text style={styles.body}>
              When you mark something replaced, add what you paid. Your spending, trends and
              forecasts will show up here.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.ringRow}>
              <View style={{ width: RING, height: RING }}>
                <Svg width={RING} height={RING}>
                  <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={colors.track} strokeWidth={STROKE} fill="none" />
                  {arcs.map((arc) => (
                    <Circle
                      key={arc.key}
                      cx={RING / 2}
                      cy={RING / 2}
                      r={R}
                      stroke={arc.color}
                      strokeWidth={STROKE}
                      strokeDasharray={`${arc.len} ${C}`}
                      strokeDashoffset={arc.offset}
                      fill="none"
                      transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                    />
                  ))}
                </Svg>
                <View style={styles.ringCenter} pointerEvents="none">
                  <Text style={styles.ringTotal} adjustsFontSizeToFit numberOfLines={1}>
                    {compact(a.total)}
                  </Text>
                  <Text style={styles.caption}>{RANGE_CAPTION[range]}</Text>
                </View>
              </View>
              <View style={styles.legend}>
                {a.byCategory.length === 0 && <Text style={styles.caption}>Nothing spent in this range</Text>}
                {a.byCategory.map((c) => (
                  <View key={c.category} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: categoryColors[c.category] }]} />
                    <View>
                      <Text style={styles.legendAmount}>
                        {compact(c.total)} <Text style={styles.caption}>{Math.round(c.share * 100)}%</Text>
                      </Text>
                      <Text style={styles.caption}>{c.category}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.tiles}>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>{COMPARE_LABEL[range]}</Text>
                {a.change != null ? (
                  <>
                    <Text style={[styles.tileValue, { color: a.change <= 0 ? colors.ok : colors.overdue }]}>
                      {a.change < 0 ? '−' : a.change > 0 ? '+' : ''}
                      {compact(Math.abs(a.change))}
                    </Text>
                    <Text style={styles.caption}>
                      {a.changePct != null ? `${Math.round(Math.abs(a.changePct) * 100)}% ${a.change <= 0 ? 'less' : 'more'}` : ''}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.tileValue}>—</Text>
                    <Text style={styles.caption}>nothing to compare</Text>
                  </>
                )}
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Monthly avg</Text>
                <Text style={styles.tileValue}>{money(a.monthlyAverage)}</Text>
                <Text style={styles.caption}>over {a.months.length} months</Text>
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Next 12 mo</Text>
                <Text style={styles.tileValue}>~{compact(a.projectedAnnual)}</Text>
                <Text style={styles.caption}>about {compact(Math.round(a.projectedAnnual / 12))}/mo</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.kicker}>IN SHORT</Text>
              {insights.map((p, i) => (
                <Text key={i} style={styles.body}>
                  {p}
                </Text>
              ))}
              {a.unpricedItemCount > 0 && (
                <Text style={styles.note}>
                  {a.unpricedItemCount === 1 ? '1 item doesn’t' : `${a.unpricedItemCount} items don’t`} have a
                  price yet, so the real total may be a little higher.
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Spending trend</Text>
                <Text style={styles.caption}>line = monthly average</Text>
              </View>
              <View style={styles.bars} accessible accessibilityLabel="Monthly spending chart">
                {a.monthlyAverage > 0 && <View style={[styles.avgLine, { bottom: avgBottom }]} />}
                {a.months.map((m) => {
                  const isBiggest = a.biggestMonth?.month === m.month;
                  const isNow = m.month === currentMonth;
                  return (
                    <View key={m.month} style={styles.barSlot}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(4, (m.total / maxMonth) * BAR_AREA),
                            backgroundColor: isBiggest
                              ? colors.primary
                              : isNow
                                ? colors.ringOk
                                : colors.track,
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
              <View style={styles.barLabels}>
                {a.months.map((m, i) => (
                  <Text
                    key={m.month}
                    style={[
                      styles.barLabel,
                      m.month === currentMonth && { color: colors.text, fontWeight: '700' },
                    ]}
                  >
                    {a.months.length > 12 && i % 3 !== 0 ? '' : m.label.charAt(0)}
                  </Text>
                ))}
              </View>
              {a.biggestMonth && (
                <Text style={styles.caption}>
                  Biggest month: {format(parseISO(`${a.biggestMonth.month}-01`), 'MMMM yyyy')},{' '}
                  {money(a.biggestMonth.total)}
                </Text>
              )}
            </View>
          </>
        )}

        {a.comingUp.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Coming up</Text>
              {a.comingUpTotal > 0 && (
                <Text style={styles.caption}>
                  ~{compact(a.comingUpTotal)} in {COMING_UP_DAYS} days
                </Text>
              )}
            </View>
            {a.comingUp.slice(0, COMING_UP_ROWS).map((x, i, list) => (
              <Pressable
                key={x.item.id}
                onPress={() => openItem(x.item.id)}
                style={[styles.listRow, i < list.length - 1 && styles.divider]}
              >
                <Text style={[styles.rowWhen, x.days < 0 && { color: colors.overdue }]}>
                  {shortDue(x.item, today)}
                </Text>
                <Text style={styles.rowName} numberOfLines={1}>
                  {x.item.name}
                </Text>
                <Text style={x.expectedCost != null ? styles.rowValue : styles.caption}>
                  {x.expectedCost != null ? compact(x.expectedCost) : 'no price'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {a.priceChanges.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Price changes</Text>
            {a.priceChanges.slice(0, PRICE_CHANGE_ROWS).map((p) => {
              const up = p.changePct > 0;
              const tone = up
                ? { fg: colors.overdue, bg: colors.overdueBg }
                : { fg: colors.ok, bg: colors.okBg };
              return (
                <Pressable key={p.item.id} onPress={() => openItem(p.item.id)} style={styles.listRow}>
                  <View style={[styles.changeIcon, { backgroundColor: tone.bg }]}>
                    <Ionicons name={up ? 'trending-up' : 'trending-down'} size={18} color={tone.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {p.item.name}
                    </Text>
                    <Text style={styles.caption}>
                      {money(p.previous)} → {money(p.last)} since {format(parseISO(p.previousDate), 'MMM yyyy')}
                    </Text>
                  </View>
                  <Text style={[styles.rowValue, { color: tone.fg }]}>
                    {up ? '+' : '−'}
                    {Math.round(Math.abs(p.changePct) * 100)}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {a.total > 0 && a.laborTotal > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Who did the work</Text>
            <View style={styles.splitBar}>
              <View style={{ flex: a.partsTotal, backgroundColor: colors.ringOk }} />
              <View style={{ flex: a.laborTotal, backgroundColor: colors.primary }} />
            </View>
            <View style={styles.cardHeader}>
              <Text style={styles.body}>
                <Text style={styles.rowValue}>{compact(a.partsTotal)}</Text> parts
              </Text>
              <Text style={styles.body}>
                <Text style={styles.rowValue}>{compact(a.laborTotal)}</Text> contractor
              </Text>
            </View>
          </View>
        )}

        {a.byItem.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cost per item, per year</Text>
            {a.byItem.map((row, i) => (
              <Pressable
                key={row.item.id}
                onPress={() => openItem(row.item.id)}
                style={[styles.listRow, i < a.byItem.length - 1 && styles.divider]}
              >
                <View style={[styles.dot, { backgroundColor: categoryColors[row.item.category] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {row.item.name}
                  </Text>
                  <Text style={styles.caption}>
                    {money(row.lastCost)} every {row.item.intervalDays} days
                  </Text>
                </View>
                <Text style={styles.rowValue}>{compact(row.annualCost)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
      gap: 14,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 4,
      gap: 4,
    },
    segmentItem: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {
      backgroundColor: colors.text,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    segmentTextActive: {
      color: colors.background,
      fontWeight: '700',
    },
    ringRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
    },
    ringCenter: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    ringTotal: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    legend: {
      flex: 1,
      gap: 10,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    legendAmount: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    tiles: {
      flexDirection: 'row',
      gap: 8,
    },
    tile: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 12,
      gap: 2,
    },
    tileLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    tileValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 18,
      gap: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 8,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    kicker: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: colors.textSecondary,
    },
    body: {
      fontSize: 15,
      lineHeight: 23,
      color: colors.text,
    },
    note: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    caption: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    bars: {
      height: BAR_AREA,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },
    barSlot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    bar: {
      borderRadius: 4,
    },
    avgLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1.5,
      backgroundColor: colors.textSecondary,
      opacity: 0.6,
      zIndex: 1,
    },
    barLabels: {
      flexDirection: 'row',
      gap: 4,
    },
    barLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      color: colors.textSecondary,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
      paddingVertical: 6,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowWhen: {
      width: 82,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    rowName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    rowValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    changeIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    splitBar: {
      flexDirection: 'row',
      height: 12,
      borderRadius: 6,
      overflow: 'hidden',
      gap: 2,
    },
  });
