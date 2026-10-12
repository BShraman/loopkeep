import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

export interface LinePoint {
  label: string; // shown when the point is selected, e.g. "3 Mar 2026"
  value: number;
}

interface Props {
  points: LinePoint[]; // oldest first
  formatValue: (value: number) => string;
  height?: number;
}

const PAD_X = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 12;

/**
 * Single-series line with a dot per point. Tapping near a point selects it and
 * shows its label and value above the plot; the latest point starts selected.
 */
export default function LineChart({ points, formatValue, height = 140 }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected ?? points.length - 1;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Pad the range so a flat or near-flat series sits mid-plot instead of on an edge.
  const span = max - min || Math.max(max * 0.2, 1);
  const lo = Math.max(0, min - span * 0.25);
  const hi = max + span * 0.25;

  const plotW = Math.max(width - PAD_X * 2, 1);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_X + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD_TOP + plotH - ((v - lo) / (hi - lo)) * plotH;

  const onPress = (locationX: number) => {
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(i) - locationX) < Math.abs(x(best) - locationX)) best = i;
    }
    setSelected(best);
  };

  const current = points[active];

  return (
    <View>
      <View style={styles.readout}>
        <Text style={[styles.readoutValue, { color: colors.text }]}>{formatValue(current.value)}</Text>
        <Text style={[styles.readoutLabel, { color: colors.textSecondary }]}>{current.label}</Text>
      </View>
      <Pressable
        onLayout={onLayout}
        onPress={(e) => onPress(e.nativeEvent.locationX)}
        accessibilityRole="image"
        accessibilityLabel={`Price trend: ${points
          .map((p) => `${p.label} ${formatValue(p.value)}`)
          .join(', ')}`}
      >
        {width > 0 && (
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((t) => (
              <Line
                key={t}
                x1={PAD_X}
                x2={width - PAD_X}
                y1={PAD_TOP + plotH * t}
                y2={PAD_TOP + plotH * t}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            <Line
              x1={x(active)}
              x2={x(active)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              stroke={colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            {points.length > 1 && (
              <Polyline
                points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={i === active ? 6 : 4}
                fill={i === active ? colors.primary : colors.card}
                stroke={i === active ? colors.card : colors.primary}
                strokeWidth={2}
              />
            ))}
          </Svg>
        )}
      </Pressable>
      <View style={styles.axisRow}>
        <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>{points[0].label}</Text>
        {points.length > 1 && (
          <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>
            {points[points.length - 1].label}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  readoutValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  readoutLabel: {
    fontSize: 12,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  axisLabel: {
    fontSize: 11,
  },
});
