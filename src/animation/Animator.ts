import type { MeshVertex, Point } from '../types';
import { distanceToPolygonEdge, isNearPolygonBoundary, pointInPolygon } from '../geometry/polygon';

function clampPointToPolygon(
  x: number,
  y: number,
  baseX: number,
  baseY: number,
  polygon: Point[],
  boundaryInset: number,
): { x: number; y: number } {
  if (pointInPolygon(x, y, polygon)) {
    const edgeDist = distanceToPolygonEdge(x, y, polygon);
    if (edgeDist >= boundaryInset) return { x, y };
  }

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const mx = baseX + (x - baseX) * mid;
    const my = baseY + (y - baseY) * mid;
    if (pointInPolygon(mx, my, polygon) && distanceToPolygonEdge(mx, my, polygon) >= boundaryInset) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return {
    x: baseX + (x - baseX) * lo,
    y: baseY + (y - baseY) * lo,
  };
}

export function animateVertices(
  vertices: MeshVertex[],
  time: number,
  speed: number,
  amplitude: number,
  clipPolygon?: Point[],
  boundaryInset = 0,
  clipAnimation = false,
): void {
  const t = time * speed * 0.001;
  const hasClip = clipPolygon && clipPolygon.length >= 3;

  for (const v of vertices) {
    if (hasClip && clipAnimation && isNearPolygonBoundary(v.baseX, v.baseY, clipPolygon!, boundaryInset)) {
      v.x = v.baseX;
      v.y = v.baseY;
      continue;
    }

    let nx = v.baseX + Math.sin(t + v.noiseSeedX) * amplitude;
    let ny = v.baseY + Math.cos(t * 0.85 + v.noiseSeedY) * amplitude;

    if (hasClip && clipAnimation) {
      const edgeRoom = distanceToPolygonEdge(v.baseX, v.baseY, clipPolygon!) - boundaryInset;
      const maxAmp = Math.max(0, edgeRoom * 0.85);
      const amp = Math.min(amplitude, maxAmp);
      nx = v.baseX + Math.sin(t + v.noiseSeedX) * amp;
      ny = v.baseY + Math.cos(t * 0.85 + v.noiseSeedY) * amp;
      const clamped = clampPointToPolygon(nx, ny, v.baseX, v.baseY, clipPolygon!, boundaryInset);
      nx = clamped.x;
      ny = clamped.y;
    }

    v.x = nx;
    v.y = ny;
  }
}
