import type { Point } from '../../src/types';
import type { DetectedRegion } from './types';
import { roundPoint, simplifyPolygon, normalizeClosedPolygon } from './simplify';
import { isShapeLineLike, polygonArea } from './regionFilters';

function parseColor(value: string | null): { r: number; g: number; b: number; a: number } | null {
  if (!value || value === 'none' || value === 'transparent') return null;
  const trimmed = value.trim();

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 255,
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) : 255,
      };
    }
  }

  const rgb = trimmed.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(',').map((s) => s.trim());
    const alpha = parts[3] !== undefined ? Number(parts[3]) : 1;
    return {
      r: Number(parts[0]),
      g: Number(parts[1]),
      b: Number(parts[2]),
      a: alpha <= 1 ? Math.round(alpha * 255) : Math.round(alpha),
    };
  }

  return null;
}

function toHex(c: { r: number; g: number; b: number }): string {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function parsePolygonAttr(pointsAttr: string, scaleX: number, scaleY: number): Point[] {
  const nums = pointsAttr.trim().split(/[\s,]+/).map(Number);
  const points: Point[] = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    points.push({ x: nums[i] * scaleX, y: nums[i + 1] * scaleY });
  }
  return points;
}

function parseRect(el: SVGRectElement, scaleX: number, scaleY: number): Point[] {
  const x = Number(el.getAttribute('x') ?? 0) * scaleX;
  const y = Number(el.getAttribute('y') ?? 0) * scaleY;
  const w = Number(el.getAttribute('width') ?? 0) * scaleX;
  const h = Number(el.getAttribute('height') ?? 0) * scaleY;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function approximatePath(path: SVGPathElement, scaleX: number, scaleY: number): Point[] {
  const len = path.getTotalLength();
  if (len < 8) return [];
  const steps = Math.max(16, Math.min(80, Math.ceil(len / 6)));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = path.getPointAtLength((len * i) / steps);
    points.push({ x: p.x * scaleX, y: p.y * scaleY });
  }
  return points;
}

function isStrokeOnly(el: Element): boolean {
  const fill = el.getAttribute('fill');
  const stroke = el.getAttribute('stroke');
  const hasFill = fill && fill !== 'none';
  const hasStroke = stroke && stroke !== 'none';
  return !hasFill && hasStroke;
}

function isIgnorableSvgElement(
  el: Element,
  points: Point[],
  area: number,
  containerWidth: number,
  containerHeight: number,
): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'line' || tag === 'polyline') return true;
  if (isStrokeOnly(el)) return true;

  const containerArea = containerWidth * containerHeight;
  if (isShapeLineLike(points, area, { containerArea })) return true;

  if (el instanceof SVGGraphicsElement) {
    try {
      const bbox = el.getBBox();
      const bw = bbox.width;
      const bh = bbox.height;
      const bboxArea = bw * bh;
      if (bboxArea > 0 && area / bboxArea < 0.28 && Math.min(bw, bh) < 10) return true;
      if (bw * bh > containerArea * 0.5) return true;
    } catch {
      /* getBBox can fail on invisible elements */
    }
  }

  const strokeWidth = Number(el.getAttribute('stroke-width') ?? 0);
  if (strokeWidth > 0 && strokeWidth < 3 && area < 2000) return true;

  return false;
}

export function detectRegionsFromSvg(
  svgText: string,
  containerWidth: number,
  containerHeight: number,
  simplifyTolerance = 2,
): DetectedRegion[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) throw new Error('Invalid SVG');

  const viewBox = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  const svgW = viewBox?.[2] ?? Number(svg.getAttribute('width')) ?? containerWidth;
  const svgH = viewBox?.[3] ?? Number(svg.getAttribute('height')) ?? containerHeight;
  const scaleX = containerWidth / svgW;
  const scaleY = containerHeight / svgH;

  const regions: DetectedRegion[] = [];
  const shapes = svg.querySelectorAll('path, polygon, rect, circle, ellipse, line, polyline');

  shapes.forEach((el, index) => {
    const fill = parseColor(el.getAttribute('fill'));
    if (!fill || fill.a < 20) return;
    if (isStrokeOnly(el)) return;

    let points: Point[] = [];
    if (el instanceof SVGPolygonElement) {
      points = parsePolygonAttr(el.getAttribute('points') ?? '', scaleX, scaleY);
    } else if (el instanceof SVGRectElement) {
      points = parseRect(el, scaleX, scaleY);
    } else if (el instanceof SVGPathElement) {
      points = approximatePath(el, scaleX, scaleY);
    } else if (el instanceof SVGCircleElement) {
      const cx = Number(el.getAttribute('cx') ?? 0) * scaleX;
      const cy = Number(el.getAttribute('cy') ?? 0) * scaleY;
      const r = Number(el.getAttribute('r') ?? 0) * Math.min(scaleX, scaleY);
      if (r < 4) return;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
    } else if (el instanceof SVGEllipseElement) {
      const cx = Number(el.getAttribute('cx') ?? 0) * scaleX;
      const cy = Number(el.getAttribute('cy') ?? 0) * scaleY;
      const rx = Number(el.getAttribute('rx') ?? 0) * scaleX;
      const ry = Number(el.getAttribute('ry') ?? 0) * scaleY;
      if (Math.min(rx, ry) < 4) return;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        points.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
      }
    } else {
      return;
    }

    if (points.length < 3) return;
    const simplified = simplifyPolygon(points, simplifyTolerance).map((p) => roundPoint(p, 1));
    const closed = normalizeClosedPolygon(simplified);
    if (closed.length < 3) return;
    const area = polygonArea(closed);
    if (isIgnorableSvgElement(el, closed, area, containerWidth, containerHeight)) return;

    regions.push({
      id: `svg-${index + 1}`,
      color: fill,
      colorHex: toHex(fill),
      area,
      points: closed,
      enabled: true,
    });
  });

  return regions;
}
