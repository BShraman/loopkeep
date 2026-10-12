import {
  isSnoozed,
  needsRestock,
  reminderTriggerDate,
  reorderUrlFor,
  snoozeDate,
  snoozeLabel,
  sparesLabel,
} from '../itemExtras';

describe('spares', () => {
  it('needs restock only when tracked and empty', () => {
    expect(needsRestock({ spares: 0 })).toBe(true);
    expect(needsRestock({ spares: 2 })).toBe(false);
    expect(needsRestock({})).toBe(false);
  });

  it('labels spares', () => {
    expect(sparesLabel({ spares: 0 })).toBe('No spares left');
    expect(sparesLabel({ spares: 1 })).toBe('1 spare');
    expect(sparesLabel({ spares: 3 })).toBe('3 spares');
    expect(sparesLabel({})).toBeNull();
  });
});

describe('reorderUrlFor', () => {
  it('uses the saved link, adding https when missing', () => {
    expect(reorderUrlFor({ name: 'x', reorderUrl: 'https://shop.example/filter' })).toBe(
      'https://shop.example/filter'
    );
    expect(reorderUrlFor({ name: 'x', reorderUrl: ' shop.example/filter ' })).toBe(
      'https://shop.example/filter'
    );
  });

  it('falls back to a shopping search by barcode, then by name', () => {
    expect(reorderUrlFor({ name: 'Air Filter', barcode: '0012345678905' })).toBe(
      'https://www.google.com/search?tbm=shop&q=0012345678905'
    );
    expect(reorderUrlFor({ name: 'Air Filter 20x25' })).toBe(
      'https://www.google.com/search?tbm=shop&q=Air%20Filter%2020x25'
    );
  });
});

describe('snooze', () => {
  it('is in effect only after today', () => {
    expect(isSnoozed({ snoozedUntil: '2026-10-13' }, '2026-10-10')).toBe(true);
    expect(isSnoozed({ snoozedUntil: '2026-10-10' }, '2026-10-10')).toBe(false);
    expect(isSnoozed({}, '2026-10-10')).toBe(false);
  });

  it('computes snooze dates across month ends', () => {
    expect(snoozeDate(new Date(2026, 9, 30), 3)).toBe('2026-11-02');
    expect(snoozeLabel('2026-11-02')).toBe('Snoozed until Nov 2');
  });

  it('fires the reminder on the snooze day while snoozed', () => {
    const base = { lastReplacedDate: '2026-07-01', intervalDays: 90, reminderLeadDays: 5 };
    const normal = reminderTriggerDate(base, '2026-09-01');
    expect([normal.getFullYear(), normal.getMonth(), normal.getDate(), normal.getHours()]).toEqual([2026, 8, 24, 9]);
    const snoozed = reminderTriggerDate({ ...base, snoozedUntil: '2026-10-13' }, '2026-10-10');
    expect([snoozed.getMonth(), snoozed.getDate(), snoozed.getHours()]).toEqual([9, 13, 9]);
    const expired = reminderTriggerDate({ ...base, snoozedUntil: '2026-10-01' }, '2026-10-10');
    expect(expired.getTime()).toBe(normal.getTime());
  });
});
