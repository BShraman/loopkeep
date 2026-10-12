import React, { useCallback, useState } from 'react';
import PricePromptSheet from '../components/PricePromptSheet';
import {
  getLastPrice,
  markReplaced,
  ReplacementDetails,
  updateHistoryDetails,
} from '../db/itemsRepository';
import { rescheduleReminderForItem } from '../notifications/notificationService';
import { getCurrencyCode, isAskPriceEnabled } from '../services/priceSettings';
import { Item, ReplacementHistory } from '../types/Item';
import { formatDate, todayISO } from '../utils/dateCalculations';

const EMPTY_DETAILS: ReplacementDetails = { price: null, labor: null, doneBy: null, note: null };

interface SheetState {
  historyId: string;
  title: string;
  subtitle?: string;
  initial: ReplacementDetails;
  currency: string;
  editing: boolean; // editing an existing row rather than just after a replacement
  onFinished?: () => void;
}

/**
 * One "mark replaced, then ask what was paid" flow shared by the dashboard,
 * item detail and scan screens. The replacement is saved first, so skipping or
 * dismissing the price sheet never loses it. Render `priceSheet` in the screen.
 */
export function useMarkReplaced() {
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const markReplacedWithPrice = useCallback(async (item: Item, onFinished?: () => void) => {
    const today = todayISO();
    const historyId = await markReplaced(item.id, today);
    await rescheduleReminderForItem({ ...item, lastReplacedDate: today });

    if (!(await isAskPriceEnabled())) {
      onFinished?.();
      return;
    }
    const [lastPrice, currency] = await Promise.all([getLastPrice(item.id), getCurrencyCode()]);
    setSheet({
      historyId,
      title: 'What did you pay?',
      subtitle: `${item.name} · replaced today`,
      initial: { price: lastPrice, labor: null, doneBy: null, note: null },
      currency,
      editing: false,
      onFinished,
    });
  }, []);

  /** Add, change or remove the price, contractor cost and notes on a history row. */
  const editPrice = useCallback(
    async (entry: ReplacementHistory, itemName: string, onFinished?: () => void) => {
      const hasDetails = entry.price != null || entry.labor != null || !!entry.doneBy || !!entry.note;
      setSheet({
        historyId: entry.id,
        title: hasDetails ? 'Edit replacement' : 'Add details',
        subtitle: `${itemName} · ${formatDate(entry.replacedDate)}`,
        initial: {
          price: entry.price ?? null,
          labor: entry.labor ?? null,
          doneBy: entry.doneBy ?? null,
          note: entry.note ?? null,
        },
        currency: await getCurrencyCode(),
        editing: true,
        onFinished,
      });
    },
    []
  );

  const close = useCallback(() => {
    const done = sheet?.onFinished;
    setSheet(null);
    done?.();
  }, [sheet]);

  const save = useCallback(
    async (details: ReplacementDetails) => {
      if (sheet) await updateHistoryDetails(sheet.historyId, details);
      close();
    },
    [sheet, close]
  );

  const priceSheet = (
    <PricePromptSheet
      visible={sheet != null}
      title={sheet?.title ?? ''}
      subtitle={sheet?.subtitle}
      currency={sheet?.currency ?? ''}
      initial={sheet?.initial ?? EMPTY_DETAILS}
      dismissLabel={sheet?.editing ? 'Cancel' : 'Skip'}
      onSave={save}
      onDismiss={close}
    />
  );

  return { markReplacedWithPrice, editPrice, priceSheet };
}
