import { expandUpcE, guessCategory, isRetailBarcode, normalizeBarcode } from '../barcode';

describe('normalizeBarcode', () => {
  it('stores UPC-A as 13-digit EAN so it matches the iOS form', () => {
    expect(normalizeBarcode('012345678905', 'upc_a')).toBe('0012345678905');
    expect(normalizeBarcode('0012345678905', 'ean13')).toBe('0012345678905');
  });

  it('pads a 12-digit code of unknown type', () => {
    expect(normalizeBarcode(' 012345678905 ')).toBe('0012345678905');
  });

  it('expands UPC-E to the same code as its UPC-A form', () => {
    // UPC-E 04252614 == UPC-A 042100005264
    expect(normalizeBarcode('04252614', 'upc_e')).toBe('0042100005264');
    expect(normalizeBarcode('042100005264', 'upc_a')).toBe('0042100005264');
  });

  it('leaves EAN-8, Code 128 and QR codes as-is', () => {
    expect(normalizeBarcode('96385074', 'ean8')).toBe('96385074');
    expect(normalizeBarcode('123456789012', 'code128')).toBe('123456789012');
    expect(normalizeBarcode('FILTER-20x25', 'qr')).toBe('FILTER-20x25');
  });
});

describe('expandUpcE', () => {
  it('handles each last-digit rule', () => {
    expect(expandUpcE('01234505')).toBe('012000003455');
    expect(expandUpcE('01234535')).toBe('012300000455');
    expect(expandUpcE('01234545')).toBe('012340000055');
    expect(expandUpcE('01234565')).toBe('012345000065');
  });

  it('rejects codes that are not UPC-E shaped', () => {
    expect(expandUpcE('21234565')).toBeNull();
    expect(expandUpcE('1234')).toBeNull();
  });
});

describe('isRetailBarcode', () => {
  it('accepts EAN/UPC lengths only', () => {
    expect(isRetailBarcode('96385074')).toBe(true);
    expect(isRetailBarcode('0012345678905')).toBe(true);
    expect(isRetailBarcode('12345')).toBe(false);
    expect(isRetailBarcode('FILTER-20x25')).toBe(false);
  });
});

describe('guessCategory', () => {
  it.each([
    ['Filtrete 20x25x1 MERV 11 Air Filter, 4-Pack', 'HVAC'],
    ['Furnace Filter 16x25x1', 'HVAC'],
    ['EveryDrop Refrigerator Water Filter 1', 'Kitchen'],
    ['Energizer 9V Batteries', 'Safety'],
    ['First Alert Smoke Detector', 'Safety'],
    ['Morton Water Softener Salt Pellets', 'Plumbing'],
    ['Paper Towels', 'Other'],
  ])('%s → %s', (title, category) => {
    expect(guessCategory(title)).toBe(category);
  });
});
