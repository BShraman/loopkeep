import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';

export const SNOOZE_OPTIONS: { days: number; label: string }[] = [
  { days: 1, label: 'Tomorrow' },
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'Next week' },
];

interface Props {
  visible: boolean;
  itemName: string;
  /** Show "Stop snoozing" when the item is already snoozed. */
  snoozed: boolean;
  onPick: (days: number | null) => void;
  onDismiss: () => void;
}

/** Pick when to be reminded again. Android alerts allow only 3 buttons, so this is a sheet. */
export default function SnoozeSheet({ visible, itemName, snoozed, onPick, onDismiss }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <Text style={styles.title}>Remind me later</Text>
          <Text style={styles.subtitle}>{itemName}</Text>
          {SNOOZE_OPTIONS.map((o) => (
            <Pressable
              key={o.days}
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.6 }]}
              onPress={() => onPick(o.days)}
              accessibilityRole="button"
            >
              <Ionicons name="alarm-outline" size={20} color={colors.primary} />
              <Text style={styles.optionText}>{o.label}</Text>
            </Pressable>
          ))}
          {snoozed && (
            <Pressable
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.6 }]}
              onPress={() => onPick(null)}
              accessibilityRole="button"
            >
              <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
              <Text style={[styles.optionText, { color: colors.danger }]}>Stop snoozing</Text>
            </Pressable>
          )}
          <Pressable style={styles.cancel} onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
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
      padding: 20,
      paddingBottom: 32,
    },
    title: {
      ...typography.heading,
      fontSize: 18,
    },
    subtitle: {
      ...typography.bodySecondary,
      marginBottom: 8,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    optionText: {
      ...typography.body,
    },
    cancel: {
      alignItems: 'center',
      paddingTop: 16,
    },
    cancelText: {
      ...typography.label,
      color: colors.textSecondary,
    },
  });
};
