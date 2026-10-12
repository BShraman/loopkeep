import { centsToInput, formatMoney, parsePrice } from '../money';

describe('parsePrice', () => {
  it.each([
    ['24', 2400],
    ['24.5', 2450],
    ['24,50', 2450],
    ['$24.99', 2499],
    ['  12 ', 1200],
    ['.5', 50],
    ['1,234', 123400],
    ['1,234.56', 123456],
    ['1.234,56', 123456],
    ['0', 0],
  ])('reads %p as %p cents', (text, cents) => {
    expect(parsePrice(text)).toBe(cents);
  });

  it.each(['', '   ', 'abc', '.', '$'])('returns null for %p', (text) => {
    expect(parsePrice(text)).toBeNull();
  });

  it('rounds to the nearest cent', () => {
    expect(parsePrice('19.999')).toBe(2000);
  });
});

describe('centsToInput', () => {
  it('drops .00 and keeps two decimals otherwise', () => {
    expect(centsToInput(2400)).toBe('24');
    expect(centsToInput(2450)).toBe('24.50');
    expect(centsToInput(5)).toBe('0.05');
  });
});

describe('formatMoney', () => {
  it('formats with the currency', () => {
    expect(formatMoney(2450, 'USD')).toContain('24.50');
    expect(formatMoney(2450, 'USD', true)).not.toContain('.50');
  });

  it('falls back when the currency code is unknown to Intl', () => {
    expect(formatMoney(2450, 'NOT_A_CODE')).toBe('NOT_A_CODE 24.50');
  });
});
