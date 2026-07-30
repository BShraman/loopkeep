import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { SettingsScreenProps } from '../navigation/RootNavigator';
import { exportBackup, importBackup } from '../db/backupService';
import { ThemePreference, useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

type Busy = 'idle' | 'exporting' | 'importing';
type Feedback = { type: 'success' | 'error'; text: string } | null;

export default function SettingsScreen(_props: SettingsScreenProps) {
  const { colors, preference, setPreference } = useTheme();
  const styles = makeStyles(colors);
  const [busy, setBusy] = useState<Busy>('idle');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleExport = async () => {
    setFeedback(null);
    setBusy('exporting');
    try {
      const { itemCount } = await exportBackup();
      setFeedback({
        type: 'success',
        text: `Exported ${itemCount} item${itemCount === 1 ? '' : 's'}. Save the file somewhere safe or send it to your other device.`,
      });
    } catch (e) {
      setFeedback({ type: 'error', text: messageOf(e, 'Export failed. Please try again.') });
    } finally {
      setBusy('idle');
    }
  };

  const handleImportConfirmed = async () => {
    setConfirmVisible(false);
    setFeedback(null);
    setBusy('importing');
    try {
      const result = await importBackup();
      if (result === null) {
        // User cancelled the file picker — no change, no message.
        return;
      }
      setFeedback({
        type: 'success',
        text: `Imported ${result.itemCount} item${result.itemCount === 1 ? '' : 's'}. Your list now matches the backup.`,
      });
    } catch (e) {
      setFeedback({ type: 'error', text: messageOf(e, "That file couldn't be imported.") });
    } finally {
      setBusy('idle');
    }
  };

  const disabled = busy !== 'idle';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ---------- About ---------- */}
      <Text style={styles.sectionLabel}>About</Text>
      <View style={styles.card}>
        <View style={styles.appRow}>
          <View style={styles.appIcon}>
            <Ionicons name="repeat" size={22} color={colors.white} />
          </View>
          <View style={styles.appMeta}>
            <Text style={styles.appName}>Loopkeep</Text>
            <Text style={styles.appVersion}>Version {APP_VERSION}</Text>
          </View>
        </View>

        <Text style={styles.description}>
          Loopkeep helps you stay on top of home maintenance — filters, batteries, and other items
          that need replacing on a schedule. Add what your home has, and it tracks what's due and
          reminds you before it is.
        </Text>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            Your data stays on this device. Nothing is sent to a server.
          </Text>
        </View>
      </View>

      {/* ---------- Appearance ---------- */}
      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.card}>
        <Text style={styles.description}>Choose how Loopkeep looks.</Text>
        <View style={styles.segment}>
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                onPress={() => setPreference(opt.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${opt.label} theme`}
              >
                <Ionicons
                  name={opt.icon}
                  size={18}
                  color={active ? colors.white : colors.textSecondary}
                />
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ---------- Backup & Restore ---------- */}
      <Text style={styles.sectionLabel}>Backup & Restore</Text>

      {feedback && (
        <View
          style={[styles.feedback, feedback.type === 'success' ? styles.feedbackOk : styles.feedbackErr]}
        >
          <Ionicons
            name={feedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={20}
            color={feedback.type === 'success' ? colors.ok : colors.danger}
          />
          <Text style={styles.feedbackText}>{feedback.text}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.description}>
          Moving to a new phone, or want a safe copy? Export a backup file and import it on the other
          device to bring all your items across.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, styles.primaryButton, pressed && styles.pressed, disabled && styles.buttonDisabled]}
        onPress={handleExport}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Export data"
      >
        {busy === 'exporting' ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Ionicons name="share-outline" size={20} color={colors.white} />
            <Text style={styles.primaryButtonText}>Export data</Text>
          </>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.pressed, disabled && styles.buttonDisabled]}
        onPress={() => {
          setFeedback(null);
          setConfirmVisible(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Import data"
      >
        {busy === 'importing' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Ionicons name="download-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Import data</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.note}>
        Importing replaces the items currently on this device with the ones in the backup file.
      </Text>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Replace your items?</Text>
            <Text style={styles.modalBody}>
              This will replace everything currently in Loopkeep on this device with the contents
              of the backup file. This can't be undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalButton, pressed && styles.pressed]}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalButton, styles.modalConfirm, pressed && styles.pressed]}
                onPress={handleImportConfirmed}
              >
                <Text style={styles.modalConfirmText}>Choose file</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
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
      gap: 12,
    },
    sectionLabel: {
      ...typography.label,
      color: colors.textSecondary,
      marginTop: 4,
      marginBottom: -2,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    appRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    appIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appMeta: {
      gap: 2,
    },
    appName: {
      ...typography.heading,
    },
    appVersion: {
      ...typography.caption,
    },
    description: {
      ...typography.bodySecondary,
      lineHeight: 20,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    infoText: {
      ...typography.bodySecondary,
      flex: 1,
      lineHeight: 20,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
      gap: 4,
    },
    segmentItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 8,
    },
    segmentItemActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      ...typography.label,
      color: colors.textSecondary,
    },
    segmentTextActive: {
      color: colors.white,
    },
    feedback: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderRadius: 12,
      padding: 12,
    },
    feedbackOk: {
      backgroundColor: colors.okBg,
    },
    feedbackErr: {
      backgroundColor: colors.overdueBg,
    },
    feedbackText: {
      ...typography.bodySecondary,
      color: colors.text,
      flex: 1,
      lineHeight: 20,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      paddingVertical: 16,
      minHeight: 54,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.85,
    },
    note: {
      ...typography.caption,
      textAlign: 'center',
      marginTop: 4,
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
    modalConfirm: {
      backgroundColor: colors.primary,
    },
    modalConfirmText: {
      ...typography.label,
      color: colors.white,
    },
  });
};
