import { describe, expect, it } from 'vitest';
import { defaultDispatchColumns, detectLatLonKeys, parseCoord } from './csv';

describe('detectLatLonKeys', () => {
  it('accepts lat/lon variants case-insensitively', () => {
    expect(detectLatLonKeys({ Lat: 1, Lon: 2 })).toEqual({ latKey: 'Lat', lonKey: 'Lon' });
    expect(detectLatLonKeys({ latitude: 1, longitude: 2 })).toEqual({ latKey: 'latitude', lonKey: 'longitude' });
    expect(detectLatLonKeys({ lat: 1, lng: 2 })).toEqual({ latKey: 'lat', lonKey: 'lng' });
  });
  it('returns null when missing', () => {
    expect(detectLatLonKeys({ x: 1 })).toEqual({ latKey: null, lonKey: null });
  });
});

describe('parseCoord', () => {
  it('parses numbers and numeric strings', () => {
    expect(parseCoord(43.5)).toBe(43.5);
    expect(parseCoord('-116.2')).toBe(-116.2);
  });
  it('does NOT coerce blank/null to 0 (the 0,0-marker bug)', () => {
    expect(parseCoord('')).toBeNaN();
    expect(parseCoord(null)).toBeNaN();
    expect(parseCoord(undefined)).toBeNaN();
  });
});

describe('defaultDispatchColumns', () => {
  it('defaults to name- and phone-like columns only', () => {
    const cols = ['name', 'Phone Number', 'address', 'lat', 'lon', 'label', 'evac_zone', 'Household Members'];
    const def = defaultDispatchColumns(cols);
    expect(def.has('name')).toBe(true);
    expect(def.has('Phone Number')).toBe(true);
    expect(def.has('Household Members')).toBe(true);
    expect(def.has('address')).toBe(false);
    expect(def.has('lat')).toBe(false);
    expect(def.has('evac_zone')).toBe(false);
  });
});
