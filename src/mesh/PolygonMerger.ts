import type { MeshPolygon, Point } from '../types';

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function polygonArea(points: Point[], vertices: number[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const pi = points[vertices[i]];
    const pj = points[vertices[j]];
    area += pi.x * pj.y - pj.x * pi.y;
  }
  return Math.abs(area) / 2;
}

function sharedEdge(a: MeshPolygon, b: MeshPolygon): [number, number] | null {
  const edgesA = new Set<string>();
  for (let i = 0; i < a.vertices.length; i++) {
    const v1 = a.vertices[i];
    const v2 = a.vertices[(i + 1) % a.vertices.length];
    edgesA.add(edgeKey(v1, v2));
  }

  for (let i = 0; i < b.vertices.length; i++) {
    const v1 = b.vertices[i];
    const v2 = b.vertices[(i + 1) % b.vertices.length];
    const key = edgeKey(v1, v2);
    if (edgesA.has(key)) {
      return [v1, v2];
    }
  }
  return null;
}

function mergePolygons(a: MeshPolygon, b: MeshPolygon, shared: [number, number]): MeshPolygon | null {
  const [e1, e2] = shared;
  const walkA: number[] = [];
  const startA = a.vertices.indexOf(e1);
  if (startA === -1) return null;

  for (let i = 0; i < a.vertices.length; i++) {
    const idx = (startA + i) % a.vertices.length;
    walkA.push(a.vertices[idx]);
    if (a.vertices[idx] === e2) break;
  }

  const walkB: number[] = [];
  const startB = b.vertices.indexOf(e2);
  if (startB === -1) return null;

  for (let i = 0; i < b.vertices.length; i++) {
    const idx = (startB + i) % b.vertices.length;
    walkB.push(b.vertices[idx]);
    if (b.vertices[idx] === e1) break;
  }

  const merged = [...walkA, ...walkB.slice(1, -1)];
  if (merged.length < 3) return null;

  const unique = new Set(merged);
  if (unique.size !== merged.length) return null;

  return { vertices: merged };
}

function minAngle(points: Point[], poly: MeshPolygon): number {
  let min = Math.PI;
  const n = poly.vertices.length;
  for (let i = 0; i < n; i++) {
    const prev = points[poly.vertices[(i - 1 + n) % n]];
    const curr = points[poly.vertices[i]];
    const next = points[poly.vertices[(i + 1) % n]];
    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const dot = v1x * v2x + v1y * v2y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 === 0 || len2 === 0) continue;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2))));
    min = Math.min(min, angle);
  }
  return min;
}

function buildEdgeMap(polygons: MeshPolygon[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (let polyIndex = 0; polyIndex < polygons.length; polyIndex++) {
    const poly = polygons[polyIndex];
    for (let i = 0; i < poly.vertices.length; i++) {
      const a = poly.vertices[i];
      const b = poly.vertices[(i + 1) % poly.vertices.length];
      const key = edgeKey(a, b);
      const list = map.get(key);
      if (list) list.push(polyIndex);
      else map.set(key, [polyIndex]);
    }
  }
  return map;
}

function getNeighborPairs(edgeMap: Map<string, number[]>): [number, number][] {
  const pairs: [number, number][] = [];
  const seen = new Set<string>();

  for (const indices of edgeMap.values()) {
    if (indices.length < 2) continue;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const a = indices[i];
        const b = indices[j];
        const pairKey = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

export function mergePolygonsToTarget(
  points: Point[],
  polygons: MeshPolygon[],
  sidesMin: number,
  sidesMax: number,
  sizeRange: { min: number; max: number },
): MeshPolygon[] {
  if (sidesMax <= 3) return polygons;

  let result = polygons.map((p) => ({ vertices: [...p.vertices] }));
  const maxIterations = result.length;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    const edgeMap = buildEdgeMap(result);
    const pairs = getNeighborPairs(edgeMap);
    let bestPair: { i: number; j: number; mergedPoly: MeshPolygon; score: number } | null = null;

    for (const [i, j] of pairs) {
      const shared = sharedEdge(result[i], result[j]);
      if (!shared) continue;

      const combined = mergePolygons(result[i], result[j], shared);
      if (!combined) continue;
      if (combined.vertices.length > sidesMax) continue;
      if (combined.vertices.length < sidesMin && combined.vertices.length < sidesMin) continue;

      const area = polygonArea(points, combined.vertices);
      const approxSide = Math.sqrt(area);
      if (approxSide > sizeRange.max * 2.5) continue;

      const score = minAngle(points, combined);
      if (!bestPair || score > bestPair.score) {
        bestPair = { i, j, mergedPoly: combined, score };
      }
    }

    if (!bestPair) break;

    const { i, j, mergedPoly } = bestPair;
    const hi = Math.max(i, j);
    const lo = Math.min(i, j);
    result.splice(hi, 1);
    result.splice(lo, 1);
    result.push(mergedPoly);
  }

  return result;
}

export function buildEdges(polygons: MeshPolygon[]): { a: number; b: number }[] {
  const edgeSet = new Set<string>();
  const edges: { a: number; b: number }[] = [];

  for (const poly of polygons) {
    for (let i = 0; i < poly.vertices.length; i++) {
      const a = poly.vertices[i];
      const b = poly.vertices[(i + 1) % poly.vertices.length];
      const key = edgeKey(a, b);
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({ a, b });
    }
  }

  return edges;
}
