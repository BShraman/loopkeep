import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ReplacementHistory } from '../types/Item';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';
import { formatDate } from '../utils/dateCalculations';
import { formatMoney } from '../utils/money';
import { itemPriceStats } from '../utils/priceTrends';
import LineChart from './charts/LineChart';

interface Props {
  history: ReplacementHistory[];
  intervalDays: number;
  currency: string;
}

const MAX_POINTS = 10;

/** Item Detail card: how this product's price has moved across replacements. */
export default function PriceTrendCard({ history, intervalDays, currency }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const stats = itemPriceStats(history, intervalDays);
  const money = (cents: number) => formatMoney(cents, currency);

  if (stats.points.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Price trend</Text>
        <Text style={styles.empty}>
          No prices yet. Add one when you next replace this, or tap a past replacement below.
        </Text>
      </View>
    );
  }

  if (stats.points.length === 1) {
    const only = stats.points[0];
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Price trend</Text>
        <Text style={styles.empty}>
          Last paid <Text style={styles.strong}>{money(only.price)}</Text> on {formatDate(only.date)}.
          The trend appears after the next priced replacement.
        </Text>
        {stats.annualCost != null && (
          <Text style={styles.empty}>About {money(stats.annualCost)} a year at this interval.</Text>
        )}
      </View>
    );
  }

  const up = (stats.change ?? 0) > 0;
  const down = (stats.change ?? 0) < 0;
  const changeColor = up ? colors.overdue : down ? colors.ok : colors.textSecondary;
  const changeText =
    stats.change == null
      ? '—'
      : `${up ? '+' : down ? '−' : ''}${money(Math.abs(stats.change))}` +
        (stats.changePct != null ? ` (${up ? '+' : down ? '−' : ''}${Math.abs(stats.changePct * 100).toFixed(0)}%)` : '');

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Price trend</Text>
      <LineChart
        points={stats.points.slice(-MAX_POINTS).map((p) => ({ label: formatDate(p.date), value: p.price }))}
        formatValue={money}
      />
      <View style={styles.statsGrid}>
        <Stat label="Last price" value={money(stats.last!)} styles={styles} />
        <Stat label="vs previous" value={changeText} color={changeColor} styles={styles} />
        <Stat label="Average" value={money(stats.average!)} styles={styles} />
        <Stat label="Total spent" value={money(stats.total)} styles={styles} />
      </View>
      {stats.annualCost != null && (
        <Text style={styles.footnote}>About {money(stats.annualCost)} a year at the current price and interval.</Text>
      )}
    </View>
  );
}

function Stat({
  label,
  value,
  color,
  styles,
}: {
  label: string;
  value: string;
  color?: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
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
      marginTop: 16,
      gap: 8,
    },
    title: {
      ...typography.heading,
      fontSize: 16,
    },
    empty: {
      ...typography.bodySecondary,
      lineHeight: 20,
    },
    strong: {
      fontWeight: '600',
      color: colors.text,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 4,
      rowGap: 10,
    },
    stat: {
      width: '50%',
    },
    statLabel: {
      ...typography.caption,
    },
    statValue: {
      ...typography.label,
      fontSize: 15,
      marginTop: 2,
    },
    footnote: {
      ...typography.caption,
      marginTop: 2,
    },
  });
};
