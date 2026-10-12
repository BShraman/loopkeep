import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReplacementDetails } from '../db/itemsRepository';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';
import { centsToInput, parsePrice } from '../utils/money';

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  currency: string;
  initial: ReplacementDetails;
  /** Label for the dismiss button: "Skip" after a replacement, "Cancel" when editing. */
  dismissLabel: string;
  onSave: (details: ReplacementDetails) => void;
  onDismiss: () => void;
}

const toText = (cents: number | null) => (cents != null ? centsToInput(cents) : '');

/**
 * Bottom sheet for one replacement: the price paid up front, and contractor
 * cost, who did it and notes behind "More details". Alert.prompt is iOS-only,
 * so this is a plain Modal that works the same on Android, iOS and web.
 */
export default function PricePromptSheet({
  visible,
  title,
  subtitle,
  currency,
  initial,
  dismissLabel,
  onSave,
  onDismiss,
}: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [price, setPrice] = useState('');
  const [labor, setLabor] = useState('');
  const [doneBy, setDoneBy] = useState('');
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPrice(toText(initial.price));
    setLabor(toText(initial.labor));
    setDoneBy(initial.doneBy ?? '');
    setNote(initial.note ?? '');
    setExpanded(initial.labor != null || !!initial.doneBy || !!initial.note);
  }, [visible, initial]);

  const priceCents = parsePrice(price);
  const laborCents = parsePrice(labor);
  const priceInvalid = price.trim() !== '' && priceCents == null;
  const laborInvalid = labor.trim() !== '' && laborCents == null;
  const canSave = !priceInvalid && !laborInvalid;

  const save = () => {
    if (!canSave) return;
    onSave({ price: priceCents, labor: laborCents, doneBy: doneBy.trim() || null, note: note.trim() || null });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

            <Text style={styles.fieldLabel}>Price paid</Text>
            <View style={[styles.inputRow, priceInvalid && { borderColor: colors.danger }]}>
              <Text style={styles.currency}>{currency}</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={() => !expanded && save()}
                accessibilityLabel="Price paid"
              />
            </View>
            {priceInvalid && <Text style={styles.error}>Enter an amount like 24.99</Text>}

            {!expanded ? (
              <Pressable style={styles.more} onPress={() => setExpanded(true)} accessibilityRole="button">
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.moreText}>Contractor cost, who did it, notes</Text>
              </Pressable>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Contractor / labor cost</Text>
                <View style={[styles.inputRow, laborInvalid && { borderColor: colors.danger }]}>
                  <Text style={styles.currency}>{currency}</Text>
                  <TextInput
                    style={styles.inputSmall}
                    value={labor}
                    onChangeText={setLabor}
                    placeholder="Optional"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Contractor or labor cost"
                  />
                </View>
                {laborInvalid && <Text style={styles.error}>Enter an amount like 120</Text>}

                <Text style={styles.fieldLabel}>Done by</Text>
                <TextInput
                  style={[styles.inputRow, styles.textInput]}
                  value={doneBy}
                  onChangeText={setDoneBy}
                  placeholder="Me, or the contractor's name"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="Done by"
                />

                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  style={[styles.inputRow, styles.textInput, styles.notes]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Brand, part number, anything to remember"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  accessibilityLabel="Notes"
                />
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={onDismiss}>
              <Text style={[styles.buttonText, { color: colors.textSecondary }]}>{dismissLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.saveButton, !canSave && { opacity: 0.5 }]}
              disabled={!canSave}
              onPress={save}
            >
              <Text style={[styles.buttonText, { color: colors.white }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: Palette) => {
  const typography = makeTypography(colors);
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 32,
      maxHeight: '90%',
    },
    body: {
      padding: 20,
      paddingBottom: 8,
      gap: 8,
    },
    title: {
      ...typography.heading,
      fontSize: 18,
    },
    subtitle: {
      ...typography.bodySecondary,
      marginTop: -4,
    },
    fieldLabel: {
      ...typography.caption,
      fontWeight: '600',
      marginTop: 6,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
    },
    currency: {
      ...typography.label,
      color: colors.textSecondary,
    },
    input: {
      flex: 1,
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      paddingVertical: 12,
    },
    inputSmall: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      paddingVertical: 10,
    },
    textInput: {
      fontSize: 16,
      color: colors.text,
      paddingVertical: 10,
    },
    notes: {
      minHeight: 64,
      textAlignVertical: 'top',
    },
    error: {
      ...typography.caption,
      color: colors.danger,
    },
    more: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    moreText: {
      ...typography.label,
      color: colors.primary,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    buttonText: {
      ...typography.label,
    },
  });
};
