import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Item, ItemStatus } from '../types/Item';
import { dueSummary, getStatus } from '../utils/dateCalculations';
import { categoryIcons } from '../utils/categoryIcons';
import DueProgressBar from './DueProgressBar';
import LastPaid from './LastPaid';
import ItemFlags from './ItemFlags';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';

const CELEBRATE_MS = 1100;
const useNativeDriver = Platform.OS !== 'web';

interface Props {
  item: Item;
  onPress: () => void;
  onMarkReplaced: () => void;
  onSnooze: () => void;
  moreOverdue?: number; // other overdue items waiting behind this one
  lastPrice?: number; // cents
  currency?: string;
}

export default function NextUpCard({
  item,
  onPress,
  onMarkReplaced,
  onSnooze,
  moreOverdue = 0,
  lastPrice,
  currency = '',
}: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [celebrating, setCelebrating] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;

  // A new item took the spot: drop any leftover celebration.
  useEffect(() => {
    setCelebrating(false);
    pop.setValue(0);
  }, [item.id, pop]);

  const accent: Record<ItemStatus, { iconBg: string; icon: string; text: string }> = {
    overdue: { iconBg: colors.overdueBg, icon: colors.ringOverdue, text: colors.overdue },
    dueSoon: { iconBg: colors.dueSoonBg, icon: colors.ringDueSoon, text: colors.dueSoon },
    ok: { iconBg: colors.okBg, icon: colors.ringOk, text: colors.ok },
  };
  const theme = accent[getStatus(item)];

  const celebrate = () => {
    if (celebrating) return;
    setCelebrating(true);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver }).start();
    setTimeout(onMarkReplaced, CELEBRATE_MS);
  };

  return (
    <Pressable onPress={onPress} style={styles.card} disabled={celebrating}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: theme.iconBg }]}>
          <Ionicons name={categoryIcons[item.category]} size={22} color={theme.icon} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.due, { color: theme.text }]}>{dueSummary(item)}</Text>
          <LastPaid price={lastPrice} currency={currency} />
          <ItemFlags item={item} />
        </View>
        {moreOverdue > 0 && (
          <Text style={[styles.chip, { color: colors.overdue, backgroundColor: colors.overdueBg }]}>
            +{moreOverdue} more overdue
          </Text>
        )}
      </View>
      <View style={styles.progress}>
        <DueProgressBar item={item} />
      </View>
      <View style={styles.buttonRow}>
        <Pressable
          onPress={celebrate}
          style={({ pressed }) => [styles.button, styles.buttonMain, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.white} />
          <Text style={[styles.buttonText, { color: colors.white }]}>Mark replaced</Text>
        </Pressable>
        <Pressable
          onPress={onSnooze}
          style={({ pressed }) => [styles.button, styles.buttonSecondary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Remind me later"
        >
          <Ionicons name="alarm-outline" size={18} color={colors.text} />
          <Text style={styles.buttonText}>Snooze</Text>
        </Pressable>
      </View>

      {celebrating && (
        <View style={[styles.celebrate, { backgroundColor: colors.okBg }]} accessibilityLiveRegion="polite">
          <Animated.View
            style={[
              styles.check,
              { backgroundColor: colors.ringOk, transform: [{ scale: pop }], opacity: pop },
            ]}
          >
            <Ionicons name="checkmark" size={34} color={colors.card} />
          </Animated.View>
          <Text style={styles.celebrateTitle}>Nice work!</Text>
          <Text style={[styles.celebrateText, { color: colors.ok }]} numberOfLines={1}>
            {item.name} is done
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 18,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    due: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 2,
    },
    chip: {
      alignSelf: 'flex-start',
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      overflow: 'hidden',
    },
    progress: {
      marginTop: 14,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    button: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      minHeight: 46,
      borderRadius: 14,
    },
    buttonMain: {
      flex: 1,
      backgroundColor: colors.primary,
    },
    buttonSecondary: {
      backgroundColor: colors.track,
    },
    pressed: {
      opacity: 0.8,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    celebrate: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: 16,
    },
    check: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    celebrateTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    celebrateText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
