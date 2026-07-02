import type { Point, Rect, ResolvedMeshFit } from '../types';
import {
  pointInPolygon,
  pointInOrOnPolygon,
  polygonArea,
  distanceToPolygonEdge,
  computeAutoPolygonSize,
  sampleBoundaryPoints,
} from '../geometry/polygon';

const MIN_POINTS = 4;

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function dedupePoints(points: Point[], minDistance: number): Point[] {
  const result: Point[] = [];
  const minDistSq = minDistance * minDistance;
  for (const p of points) {
    let ok = true;
    for (const existing of result) {
      const dx = existing.x - p.x;
      const dy = existing.y - p.y;
      if (dx * dx + dy * dy < minDistSq) {
        ok = false;
        break;
      }
    }
    if (ok) result.push(p);
  }
  return result;
}

export interface GeneratePointsOptions {
  rect: Rect;
  polygonSize: { min: number; max: number };
  pointCount?: number;
  maxPointCount?: number;
  clipPolygon?: Point[];
  meshFit?: ResolvedMeshFit;
}

export function generatePoints(options: GeneratePointsOptions): Point[] {
  const { rect, pointCount, maxPointCount, clipPolygon, meshFit } = options;
  let { polygonSize } = options;

  const hasClip = clipPolygon && clipPolygon.length >= 3;
  const boundaryInset = hasClip ? (meshFit?.boundaryInset ?? 6) : 0;

  if (hasClip && meshFit?.autoSize) {
    polygonSize = computeAutoPolygonSize(clipPolygon!, pointCount);
  }

  const avgSize = (polygonSize.min + polygonSize.max) / 2;
  const minDistance = Math.max(polygonSize.min * 0.55, 10);
  const area = hasClip ? polygonArea(clipPolygon!) : rect.width * rect.height;
  const areaBased = Math.floor(area / (avgSize * avgSize * 0.85));
  let targetCount = pointCount ?? Math.max(MIN_POINTS, areaBased);

  if (maxPointCount !== undefined && maxPointCount > 0) {
    targetCount = Math.min(targetCount, maxPointCount);
  }

  const points: Point[] = [];
  const cellSize = minDistance / Math.SQRT2;
  const cols = Math.max(1, Math.ceil(rect.width / cellSize));
  const rows = Math.max(1, Math.ceil(rect.height / cellSize));
  const grid: (Point | null)[][] = Array.from({ length: cols }, () =>
    Array.from({ length: rows }, () => null),
  );

  const rectMargin = minDistance * 0.35;

  function insideShape(x: number, y: number): boolean {
    if (hasClip) {
      const onBoundaryEpsilon = boundaryInset <= 0 ? 2 : 0;
      const inside = onBoundaryEpsilon > 0
        ? pointInOrOnPolygon(x, y, clipPolygon!, onBoundaryEpsilon)
        : pointInPolygon(x, y, clipPolygon!);
      if (!inside) return false;
      const edgeDist = distanceToPolygonEdge(x, y, clipPolygon!);
      return edgeDist >= boundaryInset;
    }
    return (
      x >= rect.x + rectMargin &&
      x <= rect.x + rect.width - rectMargin &&
      y >= rect.y + rectMargin &&
      y <= rect.y + rect.height - rectMargin
    );
  }

  function isValid(x: number, y: number): boolean {
    if (!insideShape(x, y)) return false;

    const col = Math.floor((x - rect.x) / cellSize);
    const row = Math.floor((y - rect.y) / cellSize);

    for (let i = Math.max(0, col - 2); i <= Math.min(cols - 1, col + 2); i++) {
      for (let j = Math.max(0, row - 2); j <= Math.min(rows - 1, row + 2); j++) {
        const neighbor = grid[i][j];
        if (!neighbor) continue;
        const dx = neighbor.x - x;
        const dy = neighbor.y - y;
        if (dx * dx + dy * dy < minDistance * minDistance) return false;
      }
    }
    return true;
  }

  function addPoint(x: number, y: number): boolean {
    if (!isValid(x, y)) return false;
    const point = { x, y };
    points.push(point);
    const col = Math.floor((x - rect.x) / cellSize);
    const row = Math.floor((y - rect.y) / cellSize);
    grid[col][row] = point;
    return true;
  }

  if (hasClip) {
    const boundaryPoints = sampleBoundaryPoints(clipPolygon!, avgSize * 0.9, boundaryInset);
    for (const p of dedupePoints(boundaryPoints, minDistance * 0.85)) {
      addPoint(p.x, p.y);
    }
    targetCount = Math.max(targetCount, points.length + Math.floor(area / (avgSize * avgSize * 1.2)));
  }

  const initialAttempts = targetCount * 20;
  for (let i = 0; i < initialAttempts && points.length < targetCount; i++) {
    addPoint(
      randomInRange(rect.x, rect.x + rect.width),
      randomInRange(rect.y, rect.y + rect.height),
    );
  }

  const active: Point[] = [...points];
  let safety = 0;
  const maxSafety = targetCount * 50;

  while (active.length > 0 && points.length < targetCount && safety < maxSafety) {
    safety++;
    const idx = Math.floor(Math.random() * active.length);
    const center = active[idx];
    let found = false;

    for (let k = 0; k < 32; k++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = randomInRange(minDistance, minDistance * 1.8);
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      if (addPoint(x, y)) {
        active.push(points[points.length - 1]);
        found = true;
        break;
      }
    }

    if (!found) {
      active.splice(idx, 1);
    }
  }

  if (points.length < 3 && hasClip) {
    for (let attempt = 0; attempt < 300 && points.length < 3; attempt++) {
      addPoint(
        randomInRange(rect.x, rect.x + rect.width),
        randomInRange(rect.y, rect.y + rect.height),
      );
    }
    if (points.length >= 3) return points;
    return clipPolygon!.slice(0, Math.min(clipPolygon!.length, 6));
  }

  if (points.length < 3) {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const r = Math.min(rect.width, rect.height) * 0.2;
    return [
      { x: cx, y: cy - r },
      { x: cx - r * 0.866, y: cy + r * 0.5 },
      { x: cx + r * 0.866, y: cy + r * 0.5 },
    ];
  }

  return points;
}
