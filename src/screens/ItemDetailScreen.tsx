import React, { useCallback, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Item, ReplacementHistory } from '../types/Item';
import { deleteItem, getHistoryForItem, getItemById, setSpares } from '../db/itemsRepository';
import {
  cancelReminderForItem,
  rescheduleReminderForItem,
  snoozeItem,
} from '../notifications/notificationService';
import { getCurrencyCode } from '../services/priceSettings';
import { useMarkReplaced } from '../hooks/useMarkReplaced';
import { dueSummary, formatDate, formatDueDate, getStatus, todayISO } from '../utils/dateCalculations';
import { isSnoozed, reorderUrlFor, snoozeLabel, sparesLabel } from '../utils/itemExtras';
import { entryCost, lastPriceByItem } from '../utils/priceTrends';
import SnoozeSheet from '../components/SnoozeSheet';
import { formatMoney } from '../utils/money';
import PriceTrendCard from '../components/PriceTrendCard';
import { categoryColors } from '../utils/categoryIcons';
import StatusBadge from '../components/StatusBadge';
import DueProgressBar from '../components/DueProgressBar';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export default function ItemDetailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const typography = makeTypography(colors);
  const { itemId } = route.params;
  const [item, setItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<ReplacementHistory[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [currency, setCurrency] = useState('');
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const { markReplacedWithPrice, editPrice, priceSheet } = useMarkReplaced();

  const load = useCallback(async () => {
    const loaded = await getItemById(itemId);
    setItem(loaded);
    if (loaded) {
      const [entries, code] = await Promise.all([getHistoryForItem(itemId), getCurrencyCode()]);
      setHistory(entries);
      setCurrency(code);
      navigation.setOptions({ title: loaded.name });
    }
  }, [itemId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleMarkReplaced = async () => {
    if (!item) return;
    await markReplacedWithPrice(item, load);
    await load();
  };

  const changeSpares = async (next: number | null) => {
    if (!item) return;
    await setSpares(item.id, next);
    // The reminder text mentions when spares run out.
    const updated = await getItemById(item.id);
    if (updated) await rescheduleReminderForItem(updated);
    await load();
  };

  const handleSnooze = async (days: number | null) => {
    setSnoozeOpen(false);
    if (!item) return;
    await snoozeItem(item.id, days);
    await load();
  };

  const handleDeleteConfirmed = async () => {
    if (!item) return;
    setConfirmDelete(false);
    await cancelReminderForItem(item.id);
    await deleteItem(item.id);
    navigation.goBack();
  };

  if (!item) {
    return <View style={styles.container} />;
  }

  const status = getStatus(item);
  const snoozed = isSnoozed(item, todayISO());
  const spares = sparesLabel(item);
  const lastPrice = lastPriceByItem(history).get(item.id);

  return (
    <>
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={history}
      keyExtractor={(entry) => entry.id}
      ListHeaderComponent={
        <>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={typography.heading}>{item.name}</Text>
              <StatusBadge status={status} />
            </View>
            <Text style={styles.dueSummary}>{dueSummary(item)}</Text>

            <View style={styles.progressWrap}>
              <DueProgressBar item={item} />
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Category</Text>
              <View style={styles.categoryValue}>
                <View style={[styles.categoryDot, { backgroundColor: categoryColors[item.category] }]} />
                <Text style={typography.body}>{item.category}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last replaced</Text>
              <Text style={typography.body}>{formatDate(item.lastReplacedDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due date</Text>
              <Text style={typography.body}>{formatDueDate(item)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Interval</Text>
              <Text style={typography.body}>{item.intervalDays} days</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reminder</Text>
              <Text style={typography.body}>
                {item.reminderEnabled ? `${item.reminderLeadDays} days before due` : 'Off'}
              </Text>
            </View>
            {snoozed && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{snoozeLabel(item.snoozedUntil as string)}</Text>
                <Pressable onPress={() => handleSnooze(null)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.link}>Stop snoozing</Text>
                </Pressable>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Spares on hand</Text>
              {spares == null ? (
                <Pressable onPress={() => changeSpares(0)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.link}>Track spares</Text>
                </Pressable>
              ) : (
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => changeSpares(Math.max(0, (item.spares ?? 0) - 1))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="One fewer spare"
                  >
                    <Ionicons name="remove-circle-outline" size={24} color={colors.primary} />
                  </Pressable>
                  <Text style={[typography.body, item.spares === 0 && { color: colors.dueSoon }]}>
                    {spares}
                  </Text>
                  <Pressable
                    onPress={() => changeSpares((item.spares ?? 0) + 1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="One more spare"
                  >
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  </Pressable>
                </View>
              )}
            </View>
            {item.notes ? (
              <View style={styles.notes}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={typography.body}>{item.notes}</Text>
              </View>
            ) : null}
          </View>

          <Pressable style={styles.replaceButton} onPress={handleMarkReplaced}>
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.white} />
            <Text style={styles.replaceButtonText}>Mark as Replaced Today</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, styles.reorderButton]}
            onPress={() => Linking.openURL(reorderUrlFor(item)).catch(() => {})}
            accessibilityRole="link"
          >
            <Ionicons name="cart-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>
              Reorder{lastPrice != null && currency ? ` · last paid ${formatMoney(lastPrice, currency)}` : ''}
            </Text>
          </Pressable>

          <View style={styles.actionsRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('AddEditItem', { itemId: item.id })}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setSnoozeOpen(true)}>
              <Ionicons name="alarm-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Later</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setConfirmDelete(true)}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          </View>

          <PriceTrendCard history={history} intervalDays={item.intervalDays} currency={currency} />

          <Text style={styles.historyHeader}>Replacement History</Text>
          {history.length > 0 && (
            <Text style={styles.historyHint}>
              Tap a replacement to add its price, contractor cost or notes.
            </Text>
          )}
        </>
      }
      renderItem={({ item: entry }) => {
        const cost = entryCost(entry);
        const details = [
          entry.doneBy ? `By ${entry.doneBy}` : null,
          entry.labor != null ? `incl. ${formatMoney(entry.labor, currency)} labor` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            style={({ pressed }) => [styles.historyRow, pressed && { opacity: 0.7 }]}
            onPress={() => editPrice(entry, item.name, load)}
            accessibilityRole="button"
            accessibilityLabel={`${formatDate(entry.replacedDate)}, ${
              cost != null ? formatMoney(cost, currency) : 'no price'
            }. Edit details`}
          >
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} style={styles.historyIcon} />
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{formatDate(entry.replacedDate)}</Text>
              {details ? <Text style={styles.historyMeta}>{details}</Text> : null}
              {entry.note ? <Text style={styles.historyMeta}>{entry.note}</Text> : null}
            </View>
            {cost != null ? (
              <Text style={typography.label}>{formatMoney(cost, currency)}</Text>
            ) : (
              <Text style={styles.addPrice}>Add price</Text>
            )}
          </Pressable>
        );
      }}
      ListEmptyComponent={<Text style={styles.emptyHistory}>No replacements recorded yet.</Text>}
    />

    <Modal
      visible={confirmDelete}
      transparent
      animationType="fade"
      onRequestClose={() => setConfirmDelete(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Delete “{item.name}”?</Text>
          <Text style={styles.modalBody}>
            This removes the item and its replacement history from this device. This can't be undone.
          </Text>
          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [styles.modalButton, pressed && { opacity: 0.7 }]}
              onPress={() => setConfirmDelete(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.modalButton, styles.modalDelete, pressed && { opacity: 0.85 }]}
              onPress={handleDeleteConfirmed}
            >
              <Text style={styles.modalDeleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    {priceSheet}
    <SnoozeSheet
      visible={snoozeOpen}
      itemName={item.name}
      snoozed={snoozed}
      onPick={handleSnooze}
      onDismiss={() => setSnoozeOpen(false)}
    />
    </>
  );
}

const makeStyles = (colors: Palette) => {
  const typography = makeTypography(colors);
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dueSummary: {
    ...typography.bodySecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  progressWrap: {
    marginBottom: 12,
  },
  categoryValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailLabel: {
    ...typography.bodySecondary,
    fontWeight: '600',
  },
  notes: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  replaceButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.ok,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  replaceButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  historyHeader: {
    ...typography.heading,
    fontSize: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  link: {
    ...typography.label,
    color: colors.primary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reorderButton: {
    flex: 0,
    marginTop: 12,
  },
  historyIcon: {
    marginTop: 3,
  },
  historyMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  historyHint: {
    ...typography.caption,
    marginTop: -4,
    marginBottom: 8,
  },
  addPrice: {
    ...typography.caption,
    color: colors.primary,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  emptyHistory: {
    ...typography.bodySecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  modalTitle: {
    ...typography.heading,
    fontSize: 18,
  },
  modalBody: {
    ...typography.bodySecondary,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCancelText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  modalDelete: {
    backgroundColor: colors.danger,
  },
  modalDeleteText: {
    ...typography.label,
    color: colors.white,
  },
  });
};
