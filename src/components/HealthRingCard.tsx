import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { RingCounts } from '../utils/dashboard';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';

const SIZE = 132;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const GAP = 6; // px of empty arc between segments
const FILL_MS = 900;

/** Eases 0 → 1 over FILL_MS whenever `key` changes, so the ring fills in. */
function useFillProgress(key: string): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = Date.now();
    setT(0);
    const tick = () => {
      const x = Math.min(1, (Date.now() - start) / FILL_MS);
      setT(1 - Math.pow(1 - x, 3));
      if (x < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key]);
  return t;
}

export default function HealthRingCard({ counts }: { counts: RingCounts }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const t = useFillProgress(`${counts.ok}/${counts.dueSoon}/${counts.overdue}`);

  const segments = [
    { n: counts.ok, color: colors.ringOk },
    { n: counts.dueSoon, color: colors.ringDueSoon },
    { n: counts.overdue, color: colors.ringOverdue },
  ];
  const shown = segments.filter((s) => s.n > 0).length;
  let offset = 0;
  const arcs = segments.map((s) => {
    const len = counts.total > 0 ? (s.n / counts.total) * C * t : 0;
    const visible = Math.max(0, len - (shown > 1 ? GAP : 0));
    const arc = { ...s, visible, dash: `${visible} ${C}`, offset: -offset };
    offset += len;
    return arc;
  });

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${counts.ok} of ${counts.total} items on track, ${counts.overdue} overdue, ${counts.dueThisWeek} due this week`}
    >
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.track} strokeWidth={STROKE} fill="none" />
          {arcs.map((a, i) =>
            // A zero-length dash with round caps would still paint a dot.
            a.visible > 0.5 ? (
              <Circle
                key={i}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={a.color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={a.dash}
                strokeDashoffset={a.offset}
                fill="none"
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            ) : null
          )}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.bigNumber}>{Math.round(counts.ok * t)}</Text>
          <Text style={styles.ofTotal}>of {counts.total}</Text>
        </View>
      </View>
      <View style={styles.side}>
        <Text style={styles.title}>
          {counts.ok} of {counts.total} on track
        </Text>
        <View style={styles.chips}>
          {counts.overdue > 0 && (
            <Text style={[styles.chip, { color: colors.overdue, backgroundColor: colors.overdueBg }]}>
              {counts.overdue} overdue
            </Text>
          )}
          {counts.dueThisWeek > 0 && (
            <Text style={[styles.chip, { color: colors.dueSoon, backgroundColor: colors.dueSoonBg }]}>
              {counts.dueThisWeek} this week
            </Text>
          )}
          {counts.overdue === 0 && counts.dueThisWeek === 0 && (
            <Text style={[styles.chip, { color: colors.ok, backgroundColor: colors.okBg }]}>Nothing urgent</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 18,
    },
    ring: {
      width: SIZE,
      height: SIZE,
    },
    center: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bigNumber: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 40,
    },
    ofTotal: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    side: {
      flex: 1,
      gap: 10,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      fontSize: 12,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      overflow: 'hidden',
    },
  });
