import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RootNavigator from './src/navigation/RootNavigator';
import { getDatabase, getSetting, setSetting } from './src/db/database';
import { seedIfNeeded } from './src/db/seedData';
import { requestNotificationPermissions } from './src/notifications/notificationService';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { Palette } from './src/theme/colors';
import { makeTypography } from './src/theme/typography';

const NOTIF_PROMPT_KEY = 'notificationPromptShown';

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppInner />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function AppInner() {
  const { colors, scheme } = useTheme();
  const styles = makeStyles(colors);
  const [ready, setReady] = useState(false);
  const [showNotifIntro, setShowNotifIntro] = useState(false);

  useEffect(() => {
    (async () => {
      await getDatabase();
      await seedIfNeeded();
      const prompted = await getSetting(NOTIF_PROMPT_KEY);
      setShowNotifIntro(prompted !== 'true');
      setReady(true);
    })();
  }, []);

  const finishNotifIntro = async (enable: boolean) => {
    await setSetting(NOTIF_PROMPT_KEY, 'true');
    if (enable) {
      await requestNotificationPermissions();
    }
    setShowNotifIntro(false);
  };

  const statusBarStyle = scheme === 'dark' ? 'light' : 'dark';

  if (!ready) {
    return (
      <View style={styles.loading}>
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (showNotifIntro) {
    return (
      <SafeAreaView style={styles.introContainer}>
        <StatusBar style={statusBarStyle} />
        <Ionicons name="notifications-outline" size={64} color={colors.primary} />
        <Text style={styles.introTitle}>Stay on top of home maintenance</Text>
        <Text style={styles.introBody}>
          Loopkeep can remind you a few days before a filter, battery, or other item is due for
          replacement. Reminders are scheduled on your device — nothing leaves your phone.
        </Text>
        <Pressable style={styles.introButton} onPress={() => finishNotifIntro(true)}>
          <Text style={styles.introButtonText}>Enable Reminders</Text>
        </Pressable>
        <Pressable style={styles.introSkip} onPress={() => finishNotifIntro(false)}>
          <Text style={styles.introSkipText}>Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <RootNavigator />
    </>
  );
}

const makeStyles = (colors: Palette) => {
  const typography = makeTypography(colors);
  return StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    introContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 16,
    },
    introTitle: {
      ...typography.title,
      fontSize: 24,
      textAlign: 'center',
    },
    introBody: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    introButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 48,
      marginTop: 16,
    },
    introButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    introSkip: {
      padding: 8,
    },
    introSkipText: {
      ...typography.bodySecondary,
      fontSize: 15,
    },
  });
};
