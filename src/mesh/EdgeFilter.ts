import type { MeshEdge, MeshPolygon, Point } from '../types';
import {
  distanceToPolygonEdge,
  pointInOrOnPolygon,
  segmentMidpointInside,
  getBoundaryBand,
} from '../geometry/polygon';

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export interface EdgeFilterOptions {
  boundaryBand?: number;
  onBoundaryEpsilon?: number;
}

export function filterEdgesInsidePolygon(
  edges: MeshEdge[],
  points: Point[],
  clipPolygon?: Point[],
  options: EdgeFilterOptions = {},
): MeshEdge[] {
  if (!clipPolygon || clipPolygon.length < 3) return edges;

  const boundaryBand = options.boundaryBand ?? getBoundaryBand(0);
  const onBoundaryEpsilon = options.onBoundaryEpsilon ?? 2;

  return edges.filter((edge) => {
    const a = points[edge.a];
    const b = points[edge.b];

    const aInside = pointInOrOnPolygon(a.x, a.y, clipPolygon, onBoundaryEpsilon);
    const bInside = pointInOrOnPolygon(b.x, b.y, clipPolygon, onBoundaryEpsilon);
    if (!aInside || !bInside) return false;

    const distA = distanceToPolygonEdge(a.x, a.y, clipPolygon);
    const distB = distanceToPolygonEdge(b.x, b.y, clipPolygon);
    const onOuterBand = distA <= boundaryBand || distB <= boundaryBand;

    if (onOuterBand) return true;

    return segmentMidpointInside(a.x, a.y, b.x, b.y, clipPolygon);
  });
}

export function removeIsolatedEdges(edges: MeshEdge[]): MeshEdge[] {
  if (edges.length === 0) return edges;

  const degree = new Map<number, number>();
  for (const { a, b } of edges) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }

  return edges.filter(({ a, b }) => {
    return !((degree.get(a) ?? 0) === 1 && (degree.get(b) ?? 0) === 1);
  });
}

export function filterPolygonsByEdges(
  polygons: MeshPolygon[],
  validEdges: MeshEdge[],
): MeshPolygon[] {
  const validEdgeSet = new Set(validEdges.map((e) => edgeKey(e.a, e.b)));

  return polygons
    .map((poly) => {
      const validVertices: number[] = [];
      for (let i = 0; i < poly.vertices.length; i++) {
        const a = poly.vertices[i];
        const b = poly.vertices[(i + 1) % poly.vertices.length];
        if (validEdgeSet.has(edgeKey(a, b))) {
          if (validVertices.length === 0 || validVertices[validVertices.length - 1] !== a) {
            validVertices.push(a);
          }
        }
      }
      if (validVertices.length >= 3) {
        return { vertices: validVertices };
      }
      return null;
    })
    .filter((p): p is MeshPolygon => p !== null);
}

export function rebuildPolygonsFromEdges(
  edges: MeshEdge[],
): MeshPolygon[] {
  if (edges.length === 0) return [];

  const adjacency = new Map<number, number[]>();
  for (const { a, b } of edges) {
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push(b);
    adjacency.get(b)!.push(a);
  }

  const usedEdges = new Set<string>();
  const polygons: MeshPolygon[] = [];

  for (const startEdge of edges) {
    const key = edgeKey(startEdge.a, startEdge.b);
    if (usedEdges.has(key)) continue;

    const walk: number[] = [startEdge.a, startEdge.b];
    usedEdges.add(key);
    let prev = startEdge.a;
    let curr = startEdge.b;

    for (let safety = 0; safety < edges.length + 5; safety++) {
      const neighbors = adjacency.get(curr) ?? [];
      const next = neighbors.find((n) => n !== prev && !usedEdges.has(edgeKey(curr, n)));
      if (next === undefined) break;
      if (next === walk[0] && walk.length >= 3) {
        polygons.push({ vertices: [...walk] });
        break;
      }
      usedEdges.add(edgeKey(curr, next));
      walk.push(next);
      prev = curr;
      curr = next;
    }
  }

  return polygons;
}
