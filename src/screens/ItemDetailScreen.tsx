import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Item, ReplacementHistory } from '../types/Item';
import {
  deleteItem,
  getHistoryForItem,
  getItemById,
  markReplaced,
} from '../db/itemsRepository';
import {
  cancelReminderForItem,
  rescheduleReminderForItem,
} from '../notifications/notificationService';
import { dueSummary, formatDate, formatDueDate, getStatus, todayISO } from '../utils/dateCalculations';
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

  const load = useCallback(async () => {
    const loaded = await getItemById(itemId);
    setItem(loaded);
    if (loaded) {
      setHistory(await getHistoryForItem(itemId));
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
    await markReplaced(item.id, todayISO());
    const updated = await getItemById(item.id);
    if (updated) {
      await rescheduleReminderForItem(updated);
    }
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

          <View style={styles.actionsRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('AddEditItem', { itemId: item.id })}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setConfirmDelete(true)}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          </View>

          <Text style={styles.historyHeader}>Replacement History</Text>
        </>
      }
      renderItem={({ item: entry }) => (
        <View style={styles.historyRow}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={typography.body}>{formatDate(entry.replacedDate)}</Text>
        </View>
      )}
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
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
