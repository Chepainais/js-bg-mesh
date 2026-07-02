import type { Point } from '../../src/types';
import { polygonArea } from './rasterPreprocess';

function boundingBox(points: Point[]): { w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { w: maxX - minX, h: maxY - minY };
}

export { polygonArea };

export function isShapeLineLike(
  points: Point[],
  area: number,
  options: { minArea?: number; containerArea?: number } = {},
): boolean {
  const minArea = options.minArea ?? 200;
  if (area < minArea) return true;

  if (options.containerArea && area > options.containerArea * 0.58) return true;

  const { w, h } = boundingBox(points);
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);

  if (minDim <= 4 && maxDim > 28 && area < maxDim * 12) return true;
  if (maxDim / Math.max(minDim, 0.5) > 24 && area < 12000) return true;

  const bboxArea = Math.max(w * h, 1);
  const fillRatio = area / bboxArea;
  if (fillRatio < 0.12 && area < 6000) return true;

  return false;
}

export function isRasterRegionLineLike(
  area: number,
  bboxW: number,
  bboxH: number,
  imageArea?: number,
): boolean {
  if (area < 60) return true;

  if (imageArea && area > imageArea * 0.58) return true;

  const minDim = Math.min(bboxW, bboxH);
  const maxDim = Math.max(bboxW, bboxH);

  if (minDim <= 3 && maxDim > 18) return true;
  if (minDim <= 5 && maxDim > 40 && area < maxDim * 6) return true;

  const bboxArea = Math.max(bboxW * bboxH, 1);
  if (area / bboxArea < 0.1 && area < 2500) return true;

  return false;
}
