import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

export interface Bar {
  key: string;
  label: string; // short axis label, e.g. "Mar"
  detail: string; // shown when selected, e.g. "March 2026"
  value: number;
}

interface Props {
  bars: Bar[]; // left to right
  formatValue: (value: number) => string;
  height?: number;
}

const GAP = 2;
const RADIUS = 4;

/** Rounded-top bar path anchored to the baseline. */
function barPath(x: number, w: number, top: number, base: number): string {
  const r = Math.min(RADIUS, w / 2, base - top);
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
}

/**
 * Single-series column chart. Tapping a column selects it and shows its value
 * above the plot; the last column (the current period) starts selected.
 */
export default function BarChart({ bars, formatValue, height = 120 }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected ?? bars.length - 1;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const max = Math.max(...bars.map((b) => b.value), 1);
  const slot = width / bars.length;
  const barW = Math.max(slot - GAP * 2, 2);
  const base = height - 1;

  const current = bars[active];

  return (
    <View>
      <View style={styles.readout}>
        <Text style={[styles.readoutValue, { color: colors.text }]}>{formatValue(current.value)}</Text>
        <Text style={[styles.readoutLabel, { color: colors.textSecondary }]}>{current.detail}</Text>
      </View>
      <Pressable
        onLayout={onLayout}
        onPress={(e) =>
          setSelected(Math.min(bars.length - 1, Math.max(0, Math.floor(e.nativeEvent.locationX / slot))))
        }
        accessibilityRole="image"
        accessibilityLabel={`Monthly spending: ${bars
          .map((b) => `${b.detail} ${formatValue(b.value)}`)
          .join(', ')}`}
      >
        {width > 0 && (
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={base} y2={base} stroke={colors.border} strokeWidth={1} />
            {bars.map((b, i) => {
              if (b.value <= 0) return null;
              const h = Math.max((b.value / max) * (height - 8), 3);
              return (
                <Path
                  key={b.key}
                  d={barPath(i * slot + GAP, barW, base - h, base)}
                  fill={colors.primary}
                  opacity={i === active ? 1 : 0.45}
                />
              );
            })}
          </Svg>
        )}
      </Pressable>
      <View style={styles.axisRow}>
        {bars.map((b, i) => (
          <Text
            key={b.key}
            style={[
              styles.axisLabel,
              { color: i === active ? colors.text : colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {b.label.charAt(0)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
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
    marginTop: 4,
  },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
  },
});
