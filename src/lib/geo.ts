import type { PolygonCoords, Ring, ZoneFeatureIndex } from '../types';

export function bboxOfPolys(polys: PolygonCoords[]): [number, number, number, number] {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  polys.forEach(rings => rings.forEach(ring => ring.forEach(([x, y]) => {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
  })));
  return [minx, miny, maxx, maxy];
}

/** Ray-casting point-in-ring test (ring is [[lon,lat], ...]). */
export function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/** First zone whose polygon contains the point (respecting holes), or ''. */
export function zoneForPoint(lat: number, lon: number, zones: ZoneFeatureIndex[]): string {
  for (const z of zones) {
    const [minx, miny, maxx, maxy] = z.bbox;
    if (lon < minx || lon > maxx || lat < miny || lat > maxy) continue;
    for (const rings of z.polys) {
      if (pointInRing(lon, lat, rings[0]) && !rings.slice(1).some(hole => pointInRing(lon, lat, hole))) {
        return z.name;
      }
    }
  }
  return '';
}

const kmBetween = (a: [number, number], b: [number, number]): number => {
  const dy = (a[0] - b[0]) * 110.54;
  const dx = (a[1] - b[1]) * 111.32 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

/** Union-find proximity clustering of [lat, lon] points. */
export function clusterDetections(points: [number, number][], kmThresh: number): [number, number][][] {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (kmBetween(points[i], points[j]) <= kmThresh) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, [number, number][]>();
  points.forEach((p, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(p);
  });
  return Array.from(groups.values());
}

/** Monotone-chain convex hull of [lat, lon] points; null if fewer than 3. */
export function convexHull(points: [number, number][]): [number, number][] | null {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return null;
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (dir: 1 | -1): [number, number][] => {
    const out: [number, number][] = [];
    for (const p of dir === 1 ? pts : pts.slice().reverse()) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return half(1).concat(half(-1));
}

/** GOES pixel footprint half-extents in degrees for a ~`km` pixel at `lat`. */
export function pixelHalfExtents(km: number, lat: number): { dLat: number; dLon: number } {
  return {
    dLat: km / 2 / 110.54,
    dLon: km / 2 / (111.32 * Math.cos((lat * Math.PI) / 180))
  };
}
