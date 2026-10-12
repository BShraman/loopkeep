import { getSetting, setSetting } from '../db/database';
import { DEFAULT_CURRENCY } from '../utils/money';

export const CURRENCY_KEY = 'currencyCode';
export const ASK_PRICE_KEY = 'askPriceAfterReplace';

/** One currency for the whole app; changing it relabels amounts, never converts them. */
export async function getCurrencyCode(): Promise<string> {
  return (await getSetting(CURRENCY_KEY)) || DEFAULT_CURRENCY;
}

export async function setCurrencyCode(code: string): Promise<void> {
  await setSetting(CURRENCY_KEY, code);
}

/** The "What did you pay?" sheet after Mark Replaced is on unless switched off. */
export async function isAskPriceEnabled(): Promise<boolean> {
  return (await getSetting(ASK_PRICE_KEY)) !== 'false';
}

export async function setAskPriceEnabled(enabled: boolean): Promise<void> {
  await setSetting(ASK_PRICE_KEY, enabled ? 'true' : 'false');
}
