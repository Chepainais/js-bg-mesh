import type { Point } from '../types';

export function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonBoundingRect(polygon: Point[]): import('../types').Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function scalePolygonToContainer(
  points: Point[],
  unit: 'percent' | 'pixel',
  containerWidth: number,
  containerHeight: number,
): Point[] {
  if (unit === 'pixel') {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }
  return points.map((p) => ({
    x: (p.x / 100) * containerWidth,
    y: (p.y / 100) * containerHeight,
  }));
}

export function segmentMidpointInside(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  polygon: Point[],
): boolean {
  return pointInPolygon((ax + bx) / 2, (ay + by) / 2, polygon);
}

export function segmentInsidePolygon(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  polygon: Point[],
): boolean {
  for (const t of [0.2, 0.4, 0.6, 0.8]) {
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (!pointInPolygon(x, y, polygon)) return false;
  }
  return true;
}

export function normalizeClipPolygon(points: Point[]): Point[] {
  if (points.length < 3) return points;

  const result: Point[] = [];
  const minDistance = 0.5;
  for (const point of points) {
    if (result.length === 0) {
      result.push(point);
      continue;
    }
    const last = result[result.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) >= minDistance) {
      result.push(point);
    }
  }

  if (result.length > 1) {
    const first = result[0];
    const last = result[result.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < minDistance) {
      result.pop();
    }
  }

  return result.length >= 3 ? result : points;
}

export function polygonArea(polygon: Point[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distanceToPolygonEdge(x: number, y: number, polygon: Point[]): number {
  let min = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    min = Math.min(min, distanceToSegment(x, y, polygon[i].x, polygon[i].y, polygon[j].x, polygon[j].y));
  }
  return min;
}

/** Matches outer-band detection used when filtering mesh edges near polygon boundary */
export function getBoundaryBand(boundaryInset: number): number {
  return Math.max(10, boundaryInset + 8);
}

export function isNearPolygonBoundary(
  x: number,
  y: number,
  polygon: Point[],
  boundaryInset: number,
): boolean {
  return distanceToPolygonEdge(x, y, polygon) <= getBoundaryBand(boundaryInset);
}

export function pointInOrOnPolygon(
  x: number,
  y: number,
  polygon: Point[],
  epsilon = 1.5,
): boolean {
  if (pointInPolygon(x, y, polygon)) return true;
  return distanceToPolygonEdge(x, y, polygon) <= epsilon;
}

export function polygonCentroid(polygon: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of polygon) {
    x += p.x;
    y += p.y;
  }
  return { x: x / polygon.length, y: y / polygon.length };
}

export function computeAutoPolygonSize(
  clipPolygon: Point[],
  pointCount?: number,
): { min: number; max: number } {
  const area = polygonArea(clipPolygon);
  const targetCells = pointCount && pointCount > 0
    ? pointCount
    : Math.max(6, Math.round(area / 2200));
  const cellSize = Math.sqrt(area / targetCells);
  const clamped = Math.max(14, Math.min(72, cellSize));
  return { min: Math.round(clamped * 0.7), max: Math.round(clamped * 1.3) };
}

export function sampleBoundaryPoints(
  polygon: Point[],
  spacing: number,
  inset: number,
): Point[] {
  if (polygon.length < 3 || inset < 0) return [];

  const centroid = polygonCentroid(polygon);
  const points: Point[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    const steps = Math.max(1, Math.round(len / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const toCx = centroid.x - px;
      const toCy = centroid.y - py;
      const dist = Math.hypot(toCx, toCy);
      if (dist < 1) continue;

      const x = px + (toCx / dist) * inset;
      const y = py + (toCy / dist) * inset;
      if (!pointInOrOnPolygon(x, y, polygon, 1.5)) continue;
      if (inset > 0 && distanceToPolygonEdge(x, y, polygon) < inset * 0.35) continue;
      points.push({ x, y });
    }
  }

  return points;
}
