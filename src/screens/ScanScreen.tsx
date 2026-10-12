import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { BarcodeScanningResult, BarcodeType, CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScanResult, ScanScreenProps } from '../navigation/RootNavigator';
import { getItemByBarcode } from '../db/itemsRepository';
import { useMarkReplaced } from '../hooks/useMarkReplaced';
import { isProductLookupEnabled, lookupProduct } from '../services/productLookup';
import { normalizeBarcode } from '../utils/barcode';
import { dueSummary } from '../utils/dateCalculations';
import { useTheme } from '../theme/ThemeContext';
import { Palette } from '../theme/colors';
import { makeTypography } from '../theme/typography';

const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'];

/** The scan result handed to the Add/Edit form, with the online lookup's outcome. */
async function scanResultFor(barcode: string): Promise<ScanResult> {
  const product = await lookupProduct(barcode);
  if (product) {
    return { barcode, name: product.name, category: product.category, brand: product.brand, lookup: 'found' };
  }
  return { barcode, lookup: (await isProductLookupEnabled()) ? 'none' : 'off' };
}

/**
 * Full-screen camera that reads one barcode, then:
 * - mode 'find' (Dashboard): a saved barcode offers "Mark replaced today";
 *   a new one opens Add Item pre-filled from the online lookup.
 * - mode 'attach' (Add/Edit form): hands the code (and any lookup result)
 *   back to the form it came from.
 */
export default function ScanScreen({ navigation, route }: ScanScreenProps) {
  const { mode, itemId } = route.params;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [working, setWorking] = useState(false);
  const { markReplacedWithPrice, priceSheet } = useMarkReplaced();
  // onBarcodeScanned fires repeatedly while a code is in frame; handle one.
  const handled = useRef(false);

  const resume = useCallback(() => {
    handled.current = false;
    setWorking(false);
  }, []);

  const openAddForNewCode = useCallback(
    async (barcode: string) => {
      navigation.replace('AddEditItem', { scan: await scanResultFor(barcode) });
    },
    [navigation]
  );

  const handleFind = useCallback(
    async (barcode: string) => {
      const item = await getItemByBarcode(barcode);
      if (!item) {
        await openAddForNewCode(barcode);
        return;
      }
      Alert.alert(item.name, `${dueSummary(item)}. Mark it replaced today?`, [
        { text: 'Cancel', style: 'cancel', onPress: resume },
        {
          text: 'Open item',
          onPress: () => navigation.replace('ItemDetail', { itemId: item.id }),
        },
        {
          text: 'Mark replaced',
          // Asks what was paid (unless turned off in Settings), then closes the scanner.
          onPress: () => markReplacedWithPrice(item, () => navigation.goBack()),
        },
      ], { cancelable: true, onDismiss: resume });
    },
    [markReplacedWithPrice, navigation, openAddForNewCode, resume]
  );

  const handleAttach = useCallback(
    async (barcode: string) => {
      const owner = await getItemByBarcode(barcode);
      if (owner && owner.id !== itemId) {
        Alert.alert('Barcode already used', `This barcode is already on "${owner.name}".`, [
          { text: 'Scan again', style: 'cancel', onPress: resume },
          { text: 'Open that item', onPress: () => navigation.replace('ItemDetail', { itemId: owner.id }) },
        ], { cancelable: true, onDismiss: resume });
        return;
      }
      navigation.popTo('AddEditItem', { itemId, scan: await scanResultFor(barcode) }, { merge: true });
    },
    [itemId, navigation, resume]
  );

  const onBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (handled.current) return;
      handled.current = true;
      setWorking(true);
      Vibration.vibrate(50);
      const barcode = normalizeBarcode(result.data, result.type);
      try {
        if (mode === 'find') await handleFind(barcode);
        else await handleAttach(barcode);
      } catch {
        Alert.alert('Something went wrong', 'Please try scanning again.', [
          { text: 'OK', onPress: resume },
        ]);
      }
    },
    [handleAttach, handleFind, mode, resume]
  );

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="camera-outline" size={56} color={colors.primary} />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Loopkeep uses the camera only to read product barcodes. You can still add items by hand.
        </Text>
        <Pressable
          style={styles.permButton}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        >
          <Text style={styles.permButtonText}>
            {permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
          </Text>
        </Pressable>
        <Pressable style={styles.permSkip} onPress={() => navigation.goBack()}>
          <Text style={styles.permSkipText}>Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={working ? undefined : onBarcodeScanned}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => setTorch((t) => !t)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'}
          >
            <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={26} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.frame} />
        <View style={styles.hintBox}>
          {working ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.hint}>Point the camera at the product's barcode</Text>
          )}
        </View>
      </SafeAreaView>
      {priceSheet}
    </View>
  );
}

const makeStyles = (colors: Palette) => {
  const typography = makeTypography(colors);
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 14,
      backgroundColor: colors.background,
    },
    permTitle: {
      ...typography.title,
      textAlign: 'center',
    },
    permBody: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    permButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 40,
      marginTop: 8,
    },
    permButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    permSkip: {
      padding: 8,
    },
    permSkipText: {
      ...typography.bodySecondary,
    },
    cameraContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    overlay: {
      flex: 1,
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    topBar: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    frame: {
      width: '80%',
      aspectRatio: 1.6,
      borderWidth: 3,
      borderColor: '#fff',
      borderRadius: 16,
    },
    hintBox: {
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 10,
      marginBottom: 48,
      minHeight: 40,
      justifyContent: 'center',
    },
    hint: {
      color: '#fff',
      fontSize: 15,
    },
  });
};
