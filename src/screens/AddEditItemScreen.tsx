import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { Category, Item } from '../types/Item';
import { generateId, getItemById, insertItem, updateItem } from '../db/itemsRepository';
import { rescheduleReminderForItem } from '../notifications/notificationService';
import { formatDate, todayISO, toISODate } from '../utils/dateCalculations';
import CategoryPicker from '../components/CategoryPicker';
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
    });
  }, [itemId]);

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

    const item: Item = {
      id: existing?.id ?? generateId(),
      name: trimmedName,
      category,
      lastReplacedDate,
      intervalDays: interval,
      notes: notes.trim() || undefined,
      reminderEnabled,
      reminderLeadDays: leadDays,
      isCustom: existing?.isCustom ?? true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    if (existing) {
      await updateItem(item);
    } else {
      await insertItem(item);
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
            onChange={(event, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (event.type !== 'dismissed' && date) {
                setLastReplacedDate(toISODate(date));
              }
            }}
          />
        )}

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
