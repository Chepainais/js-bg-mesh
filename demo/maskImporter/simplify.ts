import type { Point } from '../../src/types';

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function simplifyOpenPolyline(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyOpenPolyline(points.slice(0, index + 1), tolerance);
    const right = simplifyOpenPolyline(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[end]];
}

function extractChain(points: Point[], from: number, to: number): Point[] {
  const chain: Point[] = [];
  const n = points.length;
  let i = from;
  chain.push(points[i]);
  while (i !== to) {
    i = (i + 1) % n;
    chain.push(points[i]);
  }
  return chain;
}

function mergeClosedChains(chainA: Point[], chainB: Point[]): Point[] {
  if (chainA.length < 2) return chainB;
  if (chainB.length < 2) return chainA;
  return [...chainA.slice(0, -1), ...chainB.slice(0, -1)];
}

function simplifyClosedRing(points: Point[], tolerance: number): Point[] {
  if (points.length <= 3) return points;

  let maxSpan = 0;
  let idxA = 0;
  let idxB = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const span = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (span > maxSpan || (span === maxSpan && (i < idxA || (i === idxA && j < idxB)))) {
        maxSpan = span;
        idxA = i;
        idxB = j;
      }
    }
  }

  const chainA = simplifyOpenPolyline(extractChain(points, idxA, idxB), tolerance);
  const chainB = simplifyOpenPolyline(extractChain(points, idxB, idxA), tolerance);
  return mergeClosedChains(chainA, chainB);
}

export function normalizeClosedPolygon(points: Point[], minDistance = 1): Point[] {
  if (points.length === 0) return points;

  const result: Point[] = [];
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

export function simplifyPolygon(points: Point[], tolerance: number): Point[] {
  const normalized = normalizeClosedPolygon(points);
  if (normalized.length <= 3) return normalized;
  return normalizeClosedPolygon(simplifyClosedRing(normalized, tolerance));
}

export function roundPoint(p: Point, decimals = 1): Point {
  const factor = 10 ** decimals;
  return {
    x: Math.round(p.x * factor) / factor,
    y: Math.round(p.y * factor) / factor,
  };
}
