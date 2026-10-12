jest.mock('../../db/database', () => ({
  getSetting: jest.fn(async () => null),
  setSetting: jest.fn(async () => undefined),
}));

import { getSetting } from '../../db/database';
import { lookupProduct, parseLookupResponse } from '../productLookup';

describe('parseLookupResponse', () => {
  it('reads the first item into a name, brand and category', () => {
    expect(
      parseLookupResponse({
        code: 'OK',
        items: [{ title: 'Filtrete MPR 1000 Air Filter 20x25x1', brand: 'Filtrete', category: 'Home' }],
      })
    ).toEqual({ name: 'Filtrete MPR 1000 Air Filter 20x25x1', brand: 'Filtrete', category: 'HVAC' });
  });

  it('shortens very long titles at a word boundary', () => {
    const info = parseLookupResponse({
      items: [{ title: 'Super Long Product Title With Many Words That Goes On And On And On Forever' }],
    });
    expect(info!.name.length).toBeLessThanOrEqual(60);
    expect(info!.name.endsWith(' ')).toBe(false);
  });

  it('returns null when nothing usable came back', () => {
    expect(parseLookupResponse({ code: 'OK', items: [] })).toBeNull();
    expect(parseLookupResponse({ items: [{ title: '  ' }] })).toBeNull();
    expect(parseLookupResponse(null)).toBeNull();
  });
});

describe('lookupProduct', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    (getSetting as jest.Mock).mockResolvedValue(null);
  });

  it('sends only the barcode and returns the product', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ title: 'Energizer 9V Battery' }] }),
    });
    await expect(lookupProduct('0012345678905')).resolves.toMatchObject({
      name: 'Energizer 9V Battery',
      category: 'Safety',
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.upcitemdb.com/prod/trial/lookup?upc=0012345678905'
    );
  });

  it('does nothing when lookup is switched off', async () => {
    (getSetting as jest.Mock).mockResolvedValue('false');
    await expect(lookupProduct('0012345678905')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips non-retail codes', async () => {
    await expect(lookupProduct('FILTER-20x25')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when offline or rate-limited', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(lookupProduct('0012345678905')).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await expect(lookupProduct('0012345678905')).resolves.toBeNull();
  });
});
