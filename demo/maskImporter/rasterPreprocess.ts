import type { Point } from '../../src/types';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const BARRIER: Rgba = { r: 0, g: 0, b: 0, a: 255 };

function quantizeChannel(value: number, steps = 12): number {
  const clamped = Math.max(0, Math.min(255, value));
  const step = 255 / (steps - 1);
  return Math.round(Math.round(clamped / step) * step);
}

function readPixel(data: Uint8ClampedArray, index: number): Rgba {
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3],
  };
}

function writePixel(data: Uint8ClampedArray, index: number, color: Rgba): void {
  data[index] = color.r;
  data[index + 1] = color.g;
  data[index + 2] = color.b;
  data[index + 3] = color.a;
}

function quantizeColor(color: Rgba): Rgba {
  if (color.a < 40) {
    return { r: 255, g: 255, b: 255, a: 0 };
  }
  return {
    r: quantizeChannel(color.r),
    g: quantizeChannel(color.g),
    b: quantizeChannel(color.b),
    a: 255,
  };
}

export function isBarrierPixel(color: Rgba): boolean {
  if (color.a < 40) return false;
  if (color.r === 0 && color.g === 0 && color.b === 0) return true;
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  if (max < 100) return true;
  const saturation = max === 0 ? 0 : (max - min) / max;
  return saturation < 0.24 && max < 160;
}

function isAntialiasFringe(color: Rgba): boolean {
  if (color.a < 40) return false;
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  if (max > 248) return false;
  const saturation = max === 0 ? 0 : (max - min) / max;
  return saturation < 0.34 && max < 235 && min > 35;
}

export function isBackgroundPixel(color: Rgba): boolean {
  if (color.a < 40) return true;
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  if (max < 24) return true;
  return max > 232 && saturation < 0.12;
}

export function preprocessRasterImage(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const out = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const raw = readPixel(data, i);
    if (raw.a < 40) {
      writePixel(out, i, { r: 255, g: 255, b: 255, a: 0 });
      continue;
    }

    const quantized = quantizeColor(raw);
    if (isBarrierPixel(quantized) || isBarrierPixel(raw) || isAntialiasFringe(raw) || isAntialiasFringe(quantized)) {
      writePixel(out, i, BARRIER);
      continue;
    }

    if (isBackgroundPixel(quantized) || isBackgroundPixel(raw)) {
      writePixel(out, i, { r: 255, g: 255, b: 255, a: 255 });
      continue;
    }

    writePixel(out, i, quantized);
  }

  return new ImageData(out, width, height);
}

export function isLikelyStrokeColor(color: Rgba): boolean {
  return isBarrierPixel(color);
}

export function isContourClosed(
  contour: Point[],
  startX: number,
  startY: number,
  maxGap = 1.5,
): boolean {
  if (contour.length < 4) return false;
  const last = contour[contour.length - 1];
  const endX = last.x - 0.5;
  const endY = last.y - 0.5;
  return Math.hypot(endX - startX, endY - startY) <= maxGap;
}

export function isValidFilledPolygon(
  points: Point[],
  fillArea: number,
  scaleX: number,
  scaleY: number,
  bboxW: number,
  bboxH: number,
): boolean {
  const scaledFill = fillArea * scaleX * scaleY;
  const polyArea = polygonArea(points);
  if (polyArea < 120) return false;
  if (polyArea < scaledFill * 0.25) return false;

  const minDim = Math.min(bboxW, bboxH);
  const maxDim = Math.max(bboxW, bboxH);

  if (minDim <= 3 && maxDim > 20 && polyArea < maxDim * 8) return false;

  const bboxArea = Math.max(bboxW * bboxH, 1);
  if (polyArea / bboxArea < 0.1 && polyArea < 4000) return false;

  return true;
}

export function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function colorsMatch(a: Rgba, b: Rgba, tolerance = 14): boolean {
  return (
    Math.abs(a.r - b.r) <= tolerance &&
    Math.abs(a.g - b.g) <= tolerance &&
    Math.abs(a.b - b.b) <= tolerance
  );
}
