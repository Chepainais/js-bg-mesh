import type { Point, ViewTransform } from '../src/index';
import { applyViewTransformToElement } from '../src/render/viewTransform';

let highlightRaf = 0;

function getHighlightCanvas(): HTMLCanvasElement {
  return document.getElementById('zoneHighlight') as HTMLCanvasElement;
}

function getContainerSize(): { width: number; height: number } {
  const hero = document.getElementById('hero')!;
  const rect = hero.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

export function flashZonePolygon(
  points: Point[],
  colorHex: string,
  viewTransform?: ViewTransform,
): void {
  if (points.length < 3) return;

  const canvas = getHighlightCanvas();
  const { width, height } = getContainerSize();
  if (width <= 0 || height <= 0) return;

  cancelAnimationFrame(highlightRaf);
  canvas.width = width;
  canvas.height = height;
  applyViewTransformToElement(canvas, viewTransform, width, height);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const start = performance.now();
  const duration = 700;

  const draw = (alpha: number): void => {
    ctx.clearRect(0, 0, width, height);
    if (alpha <= 0) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = colorHex;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const frame = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    const alpha = Math.sin(t * Math.PI) * 0.45;
    draw(alpha);
    if (t < 1) {
      highlightRaf = requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  };

  highlightRaf = requestAnimationFrame(frame);
}

export function clearZoneHighlight(): void {
  cancelAnimationFrame(highlightRaf);
  const canvas = getHighlightCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
