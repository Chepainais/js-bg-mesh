import type { Point } from '../../src/types';
import type { DetectedRegion, MaskImportOptions } from './types';
import { roundPoint, simplifyPolygon, normalizeClosedPolygon } from './simplify';
import { isRasterRegionLineLike } from './regionFilters';
import {
  preprocessRasterImage,
  isContourClosed,
  isValidFilledPolygon,
  isBarrierPixel,
  isBackgroundPixel,
  colorsMatch,
  polygonArea,
} from './rasterPreprocess';
import { mapAnalysisPointToContainer } from './imagePlacement';
import type { ImagePlacement } from './imagePlacement';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function colorKey(c: Rgba): string {
  return `${c.r},${c.g},${c.b},${c.a}`;
}

function colorsEqual(a: Rgba, b: Rgba): boolean {
  return colorsMatch(a, b, 14);
}

function isSimilar(a: Rgba, b: Rgba, tolerance = 12): boolean {
  return (
    Math.abs(a.r - b.r) <= tolerance &&
    Math.abs(a.g - b.g) <= tolerance &&
    Math.abs(a.b - b.b) <= tolerance
  );
}

function toHex(c: Rgba): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number): Rgba {
  const i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

function detectBackground(data: Uint8ClampedArray, width: number, height: number): Rgba {
  const corners = [
    getPixel(data, width, 0, 0),
    getPixel(data, width, width - 1, 0),
    getPixel(data, width, 0, height - 1),
    getPixel(data, width, width - 1, height - 1),
  ];
  const transparent = corners.filter((c) => c.a < 20);
  if (transparent.length >= 3) return { r: 0, g: 0, b: 0, a: 0 };

  const counts = new Map<string, { color: Rgba; count: number }>();
  for (const c of corners) {
    const key = colorKey(c);
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { color: c, count: 1 });
  }
  let best = corners[0];
  let bestCount = 0;
  for (const { color, count } of counts.values()) {
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}

function maskAt(mask: Uint8Array, width: number, height: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return mask[y * width + x];
}

function isBoundaryPixel(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  if (maskAt(mask, width, height, x, y) !== 1) return false;
  return (
    maskAt(mask, width, height, x - 1, y) === 0 ||
    maskAt(mask, width, height, x + 1, y) === 0 ||
    maskAt(mask, width, height, x, y - 1) === 0 ||
    maskAt(mask, width, height, x, y + 1) === 0
  );
}

interface TracedContour {
  points: Point[];
  startX: number;
  startY: number;
}

function traceContourFrom(
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
): TracedContour | null {
  if (!isBoundaryPixel(mask, width, height, startX, startY)) return null;

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
  ];

  const points: Point[] = [];
  let x = startX;
  let y = startY;
  let backDir = 4;
  const maxSteps = width * height * 2;
  let steps = 0;
  let closed = false;

  do {
    points.push({ x: x + 0.5, y: y + 0.5 });
    let found = false;
    const searchStart = (backDir + 5) % 8;
    for (let i = 0; i < 8; i++) {
      const dir = (searchStart + i) % 8;
      const nx = x + dirs[dir].dx;
      const ny = y + dirs[dir].dy;
      if (isBoundaryPixel(mask, width, height, nx, ny)) {
        x = nx;
        y = ny;
        backDir = dir;
        found = true;
        break;
      }
    }
    if (!found) break;
    steps++;
    if (x === startX && y === startY && points.length >= 4) {
      closed = true;
      break;
    }
  } while (steps < maxSteps);

  if (!closed || !isContourClosed(points, startX, startY)) return null;
  return { points, startX, startY };
}

function traceOrthogonalContour(
  mask: Uint8Array,
  width: number,
  height: number,
): Point[] | null {
  let seedX = -1;
  let seedY = -1;

  outer: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (maskAt(mask, width, height, x, y) === 1) {
        seedX = x;
        seedY = y;
        break outer;
      }
    }
  }
  if (seedX === -1) return null;

  const filled = (x: number, y: number): boolean => maskAt(mask, width, height, x, y) === 1;

  let cx = seedX;
  let cy = seedY;
  let dir = 0;
  const points: Point[] = [{ x: cx, y: cy }];
  const maxSteps = width * height * 4;
  let steps = 0;

  const advance = (d: number): void => {
    if (d === 0) cx++;
    else if (d === 1) cy++;
    else if (d === 2) cx--;
    else cy--;
  };

  do {
    const left = (dir + 3) % 4;
    const right = (dir + 1) % 4;
    const frontX = cx + (dir === 0 ? 1 : dir === 2 ? -1 : 0);
    const frontY = cy + (dir === 1 ? 1 : dir === 3 ? -1 : 0);
    const leftX = cx + (left === 0 ? 1 : left === 2 ? -1 : 0);
    const leftY = cy + (left === 1 ? 1 : left === 3 ? -1 : 0);

    if (filled(frontX, frontY)) {
      dir = (dir + 1) % 4;
      cx = frontX;
      cy = frontY;
    } else if (filled(leftX, leftY)) {
      advance(left);
      dir = left;
    } else {
      dir = (dir + 3) % 4;
    }

    points.push({ x: cx, y: cy });
    steps++;
  } while ((cx !== seedX || cy !== seedY || points.length < 4) && steps < maxSteps);

  if (points.length < 4) return null;
  if (points[0].x !== points[points.length - 1].x || points[0].y !== points[points.length - 1].y) {
    points.push({ ...points[0] });
  }
  return points;
}

function traceLargestContour(
  mask: Uint8Array,
  width: number,
  height: number,
  fillArea: number,
): TracedContour | null {
  const minAcceptArea = Math.max(24, fillArea * 0.28);
  let best: TracedContour | null = null;
  let bestArea = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isBoundaryPixel(mask, width, height, x, y)) continue;
      const traced = traceContourFrom(mask, width, height, x, y);
      if (!traced) continue;
      const area = polygonArea(traced.points);
      if (area > bestArea) {
        bestArea = area;
        best = traced;
      }
    }
  }

  if (best && bestArea >= minAcceptArea) return best;

  const orthogonal = traceOrthogonalContour(mask, width, height);
  if (!orthogonal) return best;

  const orthoArea = polygonArea(orthogonal);
  if (orthoArea >= minAcceptArea) {
    return { points: orthogonal, startX: orthogonal[0].x - 0.5, startY: orthogonal[0].y - 0.5 };
  }

  return best;
}

function decimateContour(contour: Point[], maxPoints = 280): Point[] {
  if (contour.length <= maxPoints) return contour;
  const result: Point[] = [];
  const step = contour.length / maxPoints;
  for (let i = 0; i < maxPoints; i++) {
    result.push(contour[Math.floor(i * step)]);
  }
  return result;
}

function resolveSimplifyTolerance(containerWidth: number, explicit?: number): number {
  if (explicit != null) return explicit;
  return Math.max(5, Math.min(16, containerWidth / 120));
}

function floodFillRegion(
  data: Uint8ClampedArray,
  visited: Uint8Array,
  width: number,
  height: number,
  sx: number,
  sy: number,
  target: Rgba,
): { mask: Uint8Array; area: number; minX: number; minY: number; maxX: number; maxY: number } {
  const mask = new Uint8Array(width * height);
  const stack = [[sx, sy]];
  let area = 0;
  let minX = sx;
  let minY = sy;
  let maxX = sx;
  let maxY = sy;

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;
    if (visited[idx]) continue;
    const px = getPixel(data, width, x, y);
    if (isBarrierPixel(px)) continue;
    if (!colorsEqual(px, target)) continue;

    visited[idx] = 1;
    mask[idx] = 1;
    area++;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    if (x > 0) stack.push([x - 1, y]);
    if (x < width - 1) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y < height - 1) stack.push([x, y + 1]);
  }

  return { mask, area, minX, minY, maxX, maxY };
}

export function detectRegionsFromImageData(
  imageData: ImageData,
  options: MaskImportOptions,
): DetectedRegion[] {
  const processed = preprocessRasterImage(imageData);
  const { width, height } = processed;
  const data = processed.data;
  const visited = new Uint8Array(width * height);
  const background = options.backgroundColor ?? detectBackground(data, width, height);
  const placement: ImagePlacement = options.placement ?? {
    analysisWidth: width,
    analysisHeight: height,
    offsetX: 0,
    offsetY: 0,
    drawWidth: options.containerWidth,
    drawHeight: options.containerHeight,
  };
  const minArea = options.minRegionArea ?? 80;
  const tolerance = resolveSimplifyTolerance(placement.drawWidth, options.simplifyTolerance);
  const regions: DetectedRegion[] = [];
  const imageArea = width * height;
  const minVertexGap = Math.max(2.5, tolerance * 0.4);
  const scaleX = placement.drawWidth / width;
  const scaleY = placement.drawHeight / height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;
      const color = getPixel(data, width, x, y);
      if (isBackgroundPixel(color) || isSimilar(color, background)) {
        visited[idx] = 1;
        continue;
      }
      if (isBarrierPixel(color)) {
        visited[idx] = 1;
        continue;
      }

      const fill = floodFillRegion(data, visited, width, height, x, y, color);
      const bboxW = fill.maxX - fill.minX + 1;
      const bboxH = fill.maxY - fill.minY + 1;

      if (fill.area < minArea) continue;
      if (fill.area > imageArea * 0.58) continue;
      if (isRasterRegionLineLike(fill.area, bboxW, bboxH, imageArea)) continue;

      const traced = traceLargestContour(fill.mask, width, height, fill.area);

      const toScaledPoints = (points: Point[]): Point[] =>
        points.map((p) => mapAnalysisPointToContainer(p.x, p.y, placement));

      const buildClosedPolygon = (points: Point[]): Point[] => {
        const simplified = simplifyPolygon(points, tolerance).map((p) => roundPoint(p, 1));
        let closed = normalizeClosedPolygon(simplified, minVertexGap);
        if (closed.length < 3) {
          closed = normalizeClosedPolygon(points, minVertexGap);
        }
        return closed;
      };

      if (!traced) continue;

      let closed = buildClosedPolygon(toScaledPoints(decimateContour(traced.points)));
      if (closed.length < 3) continue;
      if (!isValidFilledPolygon(closed, fill.area, scaleX, scaleY, bboxW, bboxH)) continue;

      const scaledArea = fill.area * scaleX * scaleY;
      regions.push({
        id: `region-${regions.length + 1}`,
        color,
        colorHex: toHex(color),
        area: scaledArea,
        points: closed,
        enabled: true,
      });
    }
  }

  regions.sort((a, b) => b.area - a.area);

  const largest = regions[0]?.area ?? 0;
  const minKeepArea = Math.max(180, largest * 0.12);
  return regions.filter((region) => region.area >= minKeepArea);
}
