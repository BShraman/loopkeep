import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseISO } from 'date-fns';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Category, Item, ReplacementHistory } from '../types/Item';
import {
  addHistoryEntry,
  generateId,
  getItemById,
  getLatestHistoryEntry,
  insertItem,
  setHistoryPrice,
  updateItem,
} from '../db/itemsRepository';
import { getCurrencyCode } from '../services/priceSettings';
import { centsToInput, parsePrice } from '../utils/money';
import { reorderUrlFor } from '../utils/itemExtras';
import { rescheduleReminderForItem } from '../notifications/notificationService';
import { formatDate, todayISO, toISODate } from '../utils/dateCalculations';
import CategoryPicker from '../components/CategoryPicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditItem'>;

const INTERVAL_PRESETS = [30, 60, 90, 180, 365];

export default function AddEditItemScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const typography = makeTypography(colors);
  const itemId = route.params?.itemId;
  const [existing, setExisting] = useState<Item | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [lastReplacedDate, setLastReplacedDate] = useState(todayISO());
  const [intervalDays, setIntervalDays] = useState('90');
  const [notes, setNotes] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderLeadDays, setReminderLeadDays] = useState('5');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [barcode, setBarcode] = useState<string | undefined>(undefined);
  // Why a scan left the name blank, shown under the barcode.
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [spares, setSparesText] = useState(''); // blank = not tracking spares
  const [reorderUrl, setReorderUrl] = useState('');
  // Editing: the price field edits the most recent replacement's price.
  const [latestEntry, setLatestEntry] = useState<ReplacementHistory | null>(null);
  const [currency, setCurrency] = useState('');
  const scan = route.params?.scan;
  const canScan = Platform.OS !== 'web';

  useEffect(() => {
    getCurrencyCode().then(setCurrency);
  }, []);

  useEffect(() => {
    if (!itemId) return;
    getItemById(itemId).then((item) => {
      if (!item) return;
      setExisting(item);
      setName(item.name);
      setCategory(item.category);
      setLastReplacedDate(item.lastReplacedDate);
      setIntervalDays(String(item.intervalDays));
      setNotes(item.notes ?? '');
      setReminderEnabled(item.reminderEnabled);
      setReminderLeadDays(String(item.reminderLeadDays));
      setBarcode(item.barcode);
      setSparesText(item.spares != null ? String(item.spares) : '');
      setReorderUrl(item.reorderUrl ?? '');
    });
    getLatestHistoryEntry(itemId).then((entry) => {
      setLatestEntry(entry);
      if (entry?.price != null) setPrice(centsToInput(entry.price));
    });
  }, [itemId]);

  // A barcode scan (from the Dashboard or the Scan button below) arrives as a
  // route param. Only fill fields the user hasn't typed into yet.
  useEffect(() => {
    if (!scan) return;
    setBarcode(scan.barcode);
    setScanNote(
      scan.lookup === 'off'
        ? 'Barcode added. Product lookup is off in Settings, so type the name.'
        : scan.lookup === 'none'
          ? 'Barcode added. No product details were found online for it, so type the name.'
          : null
    );
    if (scan.name && !name.trim()) {
      setName(scan.name);
      if (scan.category) setCategory(scan.category);
    }
    if (scan.brand && !notes.trim()) setNotes(`Brand: ${scan.brand}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a name for the item.');
      return;
    }
    const interval = parseInt(intervalDays, 10);
    if (!interval || interval <= 0) {
      Alert.alert('Invalid interval', 'Interval must be a positive number of days.');
      return;
    }
    const leadDays = parseInt(reminderLeadDays, 10);
    if (isNaN(leadDays) || leadDays < 0) {
      Alert.alert('Invalid lead days', 'Reminder lead days must be 0 or more.');
      return;
    }
    const sparesCount = spares.trim() === '' ? undefined : parseInt(spares, 10);
    if (sparesCount !== undefined && (isNaN(sparesCount) || sparesCount < 0)) {
      Alert.alert('Invalid spares', 'Spares on hand must be 0 or more, or blank to not track them.');
      return;
    }
    const priceCents = parsePrice(price);
    if (price.trim() && priceCents == null) {
      Alert.alert('Invalid price', 'Enter the price paid as a number, like 24.99, or leave it blank.');
      return;
    }

    const item: Item = {
      id: existing?.id ?? generateId(),
      name: trimmedName,
      category,
      lastReplacedDate,
      intervalDays: interval,
      notes: notes.trim() || undefined,
      barcode,
      spares: sparesCount,
      reorderUrl: reorderUrl.trim() || undefined,
      snoozedUntil: existing?.snoozedUntil,
      reminderEnabled,
      reminderLeadDays: leadDays,
      isCustom: existing?.isCustom ?? true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    if (existing) {
      await updateItem(item);
      if (latestEntry) {
        if (priceCents !== (latestEntry.price ?? null)) await setHistoryPrice(latestEntry.id, priceCents);
      } else if (priceCents != null) {
        // No replacement recorded yet: count this price as the purchase on the last-replaced date.
        await addHistoryEntry(item.id, lastReplacedDate, priceCents);
      }
    } else {
      await insertItem(item);
      // The first purchase counts toward the price trend, dated when it was replaced.
      if (priceCents != null) await addHistoryEntry(item.id, lastReplacedDate, priceCents);
    }
    await rescheduleReminderForItem(item);
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. AC Filter"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={styles.label}>Barcode</Text>
        <View style={styles.barcodeRow}>
          <Text style={[typography.body, styles.barcodeText, !barcode && styles.barcodeEmpty]}>
            {barcode ?? 'None'}
          </Text>
          {barcode && (
            <Pressable
              onPress={() => {
                setBarcode(undefined);
                setScanNote(null);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Remove barcode"
            >
              <Ionicons name="close-circle-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          )}
          {canScan && (
            <Pressable
              style={styles.scanButton}
              onPress={() => navigation.navigate('Scan', { mode: 'attach', itemId })}
              accessibilityRole="button"
              accessibilityLabel="Scan barcode"
            >
              <Ionicons name="barcode-outline" size={20} color={colors.white} />
              <Text style={styles.scanButtonText}>Scan</Text>
            </Pressable>
          )}
        </View>

        {scanNote && barcode && <Text style={styles.hint}>{scanNote}</Text>}

        <Text style={styles.label}>Category</Text>
        <CategoryPicker value={category} onChange={setCategory} />

        <Text style={styles.label}>Last Replaced</Text>
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={typography.body}>{formatDate(lastReplacedDate)}</Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={parseISO(lastReplacedDate)}
            mode="date"
            maximumDate={new Date()}
            onValueChange={(_event, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              setLastReplacedDate(toISODate(date));
            }}
            onDismiss={() => setShowDatePicker(false)}
          />
        )}

        <Text style={styles.label}>
          {itemId ? 'Last price paid' : 'Price paid'}
          {currency ? ` (${currency})` : ''}
        </Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="Optional, e.g. 24.99"
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          accessibilityLabel="Price paid"
        />
        {itemId && latestEntry && (
          <Text style={styles.hint}>For the replacement on {formatDate(latestEntry.replacedDate)}.</Text>
        )}
        {(barcode || name.trim()) && (
          <Pressable
            style={styles.priceLink}
            onPress={() =>
              Linking.openURL(reorderUrlFor({ barcode, name: name.trim() })).catch(() => {})
            }
            hitSlop={8}
            accessibilityRole="link"
          >
            <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
            <Text style={styles.priceLinkText}>Check price online</Text>
          </Pressable>
        )}

        <Text style={styles.label}>Spares on hand</Text>
        <TextInput
          style={styles.input}
          value={spares}
          onChangeText={setSparesText}
          placeholder="Leave blank to not track spares"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          accessibilityLabel="Spares on hand"
        />
        <Text style={styles.hint}>Each Mark Replaced uses one. You'll be told when you run out.</Text>

        <Text style={styles.label}>Reorder link</Text>
        <TextInput
          style={styles.input}
          value={reorderUrl}
          onChangeText={setReorderUrl}
          placeholder="Optional, e.g. a store's product page"
          placeholderTextColor={colors.textSecondary}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Reorder link"
        />
        <Text style={styles.hint}>Without a link, Reorder searches stores for the barcode or name.</Text>

        <Text style={styles.label}>Interval (days)</Text>
        <TextInput
          style={styles.input}
          value={intervalDays}
          onChangeText={setIntervalDays}
          keyboardType="number-pad"
        />
        <View style={styles.presets}>
          {INTERVAL_PRESETS.map((preset) => {
            const selected = intervalDays === String(preset);
            return (
              <Pressable
                key={preset}
                style={[styles.presetChip, selected && styles.presetChipSelected]}
                onPress={() => setIntervalDays(String(preset))}
              >
                <Text style={[styles.presetText, selected && styles.presetTextSelected]}>
                  {preset}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes (filter size, brand, etc.)"
          placeholderTextColor={colors.textSecondary}
          multiline
        />

        <View style={styles.reminderRow}>
          <Text style={typography.label}>Reminder</Text>
          <Switch
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            trackColor={{ true: colors.primary }}
          />
        </View>
        {reminderEnabled && (
          <>
            <Text style={styles.label}>Remind me this many days before due</Text>
            <TextInput
              style={styles.input}
              value={reminderLeadDays}
              onChangeText={setReminderLeadDays}
              keyboardType="number-pad"
            />
          </>
        )}

        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{existing ? 'Save Changes' : 'Add Item'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Palette) => {
  const typography = makeTypography(colors);
  return StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  hint: {
    ...typography.caption,
    marginTop: 4,
  },
  label: {
    ...typography.label,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 48,
  },
  barcodeText: {
    flex: 1,
  },
  barcodeEmpty: {
    color: colors.textSecondary,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scanButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  priceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  priceLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  presets: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetText: {
    fontSize: 14,
    color: colors.text,
  },
  presetTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  });
};
