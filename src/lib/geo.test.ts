import { describe, expect, it } from 'vitest';
import { bboxOfPolys, clusterDetections, convexHull, pointInRing, zoneForPoint } from './geo';
import type { ZoneFeatureIndex } from '../types';

const square: number[][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]; // [lon, lat]
const hole: number[][] = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];

describe('pointInRing', () => {
  it('detects inside and outside', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
    expect(pointInRing(11, 5, square)).toBe(false);
    expect(pointInRing(-1, -1, square)).toBe(false);
  });
});

describe('zoneForPoint', () => {
  const zones: ZoneFeatureIndex[] = [
    { name: 'Z1', polys: [[square, hole]], bbox: bboxOfPolys([[square, hole]]) }
  ];
  it('matches a point in the polygon', () => {
    expect(zoneForPoint(2, 2, zones)).toBe('Z1'); // lat 2, lon 2
  });
  it('respects holes', () => {
    expect(zoneForPoint(5, 5, zones)).toBe('');
  });
  it('misses points outside the bbox', () => {
    expect(zoneForPoint(50, 50, zones)).toBe('');
  });
});

describe('clusterDetections', () => {
  it('groups nearby points and separates distant ones', () => {
    const pts: [number, number][] = [
      [43.0, -116.0],
      [43.005, -116.005], // ~0.7 km away
      [44.0, -115.0] // far away
    ];
    const clusters = clusterDetections(pts, 2);
    expect(clusters).toHaveLength(2);
    expect(clusters.find(c => c.length === 2)).toBeTruthy();
  });
});

describe('convexHull', () => {
  it('returns null for fewer than 3 points', () => {
    expect(convexHull([[0, 0], [1, 1]])).toBeNull();
  });
  it('drops interior points', () => {
    const hull = convexHull([[0, 0], [0, 10], [10, 10], [10, 0], [5, 5]]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual([5, 5]);
  });
});
