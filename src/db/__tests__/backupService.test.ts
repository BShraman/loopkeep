jest.mock('../itemsRepository', () => ({}));
jest.mock('../../notifications/notificationService', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('../../services/priceSettings', () => ({}));
jest.mock('expo-file-system', () => ({}), { virtual: true });

import { parseBackup } from '../backupService';

const item = {
  id: 'a1',
  name: 'Air Filter',
  category: 'HVAC',
  lastReplacedDate: '2026-09-01',
  intervalDays: 90,
  reminderEnabled: true,
  reminderLeadDays: 5,
  isCustom: true,
  createdAt: '2026-09-01T00:00:00.000Z',
};

describe('parseBackup barcode support', () => {
  it('keeps an item barcode through a backup', () => {
    const data = parseBackup(
      JSON.stringify({ app: 'loopkeep', version: 1, items: [{ ...item, barcode: '0012345678905' }], history: [] })
    );
    expect(data.items[0].barcode).toBe('0012345678905');
  });

  it('still restores a backup made before barcodes existed', () => {
    const data = parseBackup(JSON.stringify({ app: 'loopkeep', version: 1, items: [item], history: [] }));
    expect(data.items[0].name).toBe('Air Filter');
    expect(data.items[0].barcode).toBeUndefined();
  });
});

describe('parseBackup price support', () => {
  const history = { id: 'h1', itemId: 'a1', replacedDate: '2026-09-01' };

  it('keeps prices and currency through a backup', () => {
    const data = parseBackup(
      JSON.stringify({
        app: 'loopkeep',
        version: 2,
        currencyCode: 'EUR',
        items: [item],
        history: [{ ...history, price: 2450 }],
      })
    );
    expect(data.history[0].price).toBe(2450);
    expect(data.currencyCode).toBe('EUR');
  });

  it('restores a version 1 backup with no prices', () => {
    const data = parseBackup(JSON.stringify({ app: 'loopkeep', version: 1, items: [item], history: [history] }));
    expect(data.history[0].price).toBeUndefined();
    expect(data.currencyCode).toBeUndefined();
  });

  it('drops bad price and currency values instead of failing', () => {
    const data = parseBackup(
      JSON.stringify({
        app: 'loopkeep',
        version: 2,
        currencyCode: 'dollars',
        items: [item],
        history: [
          { ...history, price: -5 },
          { ...history, id: 'h2', price: '12' },
          { ...history, id: 'h3', price: null },
        ],
      })
    );
    expect(data.history.map((h) => h.price)).toEqual([undefined, undefined, undefined]);
    expect(data.currencyCode).toBeUndefined();
  });

  it('rejects a backup from a newer app version', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'loopkeep', version: 4, items: [] }))).toThrow(
      /newer version/
    );
  });
});

describe('parseBackup spares, snooze and notes', () => {
  it('keeps the new item and history fields', () => {
    const data = parseBackup(
      JSON.stringify({
        app: 'loopkeep',
        version: 3,
        items: [{ ...item, spares: 2, reorderUrl: 'https://shop.example/f', snoozedUntil: '2026-10-13' }],
        history: [
          { id: 'h1', itemId: 'a1', replacedDate: '2026-09-01', price: 2000, labor: 8000, doneBy: 'Ace HVAC', note: '3M MPR 1500' },
        ],
      })
    );
    expect(data.items[0]).toMatchObject({ spares: 2, reorderUrl: 'https://shop.example/f', snoozedUntil: '2026-10-13' });
    expect(data.history[0]).toMatchObject({ price: 2000, labor: 8000, doneBy: 'Ace HVAC', note: '3M MPR 1500' });
  });

  it('drops bad values and leaves older backups untouched', () => {
    const data = parseBackup(
      JSON.stringify({
        app: 'loopkeep',
        version: 3,
        items: [{ ...item, spares: -1, reorderUrl: '  ', snoozedUntil: 'soon' }, item],
        history: [{ id: 'h1', itemId: 'a1', replacedDate: '2026-09-01', labor: 'lots', doneBy: 5 }],
      })
    );
    expect(data.items[0].spares).toBeUndefined();
    expect(data.items[0].reorderUrl).toBeUndefined();
    expect(data.items[0].snoozedUntil).toBeUndefined();
    expect(data.items[1].spares).toBeUndefined();
    expect(data.history[0].labor).toBeUndefined();
    expect(data.history[0].doneBy).toBeUndefined();
  });
});
