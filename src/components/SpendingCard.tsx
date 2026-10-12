import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';
import { formatMoney } from '../utils/money';
import { MonthSpend, SpendingSummary } from '../utils/priceTrends';
import LineChart from './charts/LineChart';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthPoints(monthly: MonthSpend[]) {
  return monthly.map((m) => ({
    label: `${MONTH_NAMES[Number(m.month.slice(5, 7)) - 1]} ${m.month.slice(0, 4)}`,
    value: m.total,
  }));
}

interface Props {
  summary: SpendingSummary;
  currency: string;
  onPress?: () => void;
}

/** Dashboard card: the trend of monthly upkeep spend over the last year and where it's heading. */
export default function SpendingCard({ summary, currency, onPress }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const money = (cents: number) => formatMoney(cents, currency);
  const compact = (cents: number) => formatMoney(cents, currency, true);

  const up = (summary.change ?? 0) > 0;
  const down = (summary.change ?? 0) < 0;

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel="Open spending details"
      >
        <Text style={styles.title}>Spending</Text>
        {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
      </Pressable>

      <View style={styles.headline}>
        <View style={styles.headlineItem}>
          <Text style={styles.big}>{compact(summary.last12)}</Text>
          <Text style={styles.caption}>last 12 months</Text>
          {summary.change != null && (
            <Text style={[styles.change, { color: up ? colors.overdue : down ? colors.ok : colors.textSecondary }]}>
              {up ? '▲ ' : down ? '▼ ' : ''}
              {compact(Math.abs(summary.change))}
              {summary.changePct != null ? ` (${Math.abs(summary.changePct * 100).toFixed(0)}%)` : ''} vs year before
            </Text>
          )}
        </View>
        <View style={styles.headlineItem}>
          <Text style={styles.big}>{compact(summary.projectedAnnual)}</Text>
          <Text style={styles.caption}>projected next 12 months</Text>
          {summary.unpricedItemCount > 0 && (
            <Text style={styles.caption}>
              {summary.unpricedItemCount} {summary.unpricedItemCount === 1 ? 'item has' : 'items have'} no price
            </Text>
          )}
        </View>
      </View>

      <LineChart points={monthPoints(summary.monthly)} formatValue={money} height={120} />
    </View>
  );
}

const makeStyles = (colors: Palette) => {
  const typography = makeTypography(colors);
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 20,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      ...typography.heading,
      fontSize: 16,
    },
    headline: {
      flexDirection: 'row',
      gap: 12,
    },
    headlineItem: {
      flex: 1,
    },
    big: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    caption: {
      ...typography.caption,
    },
    change: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
  });
};
