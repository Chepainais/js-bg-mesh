import type { MeshVertex, Point, ResolvedZoneConfig, ZoneMesh } from '../types';
import { getBoundaryBand } from '../geometry/polygon';
import { generatePoints } from './PointGenerator';
import { triangulate } from './Triangulator';
import { buildEdges, mergePolygonsToTarget } from './PolygonMerger';
import { filterEdgesInsidePolygon, removeIsolatedEdges, rebuildPolygonsFromEdges } from './EdgeFilter';
import { assignPolygonCellFills } from './cellFill';

function createVertices(points: Point[]): MeshVertex[] {
  return points.map((p) => ({
    baseX: p.x,
    baseY: p.y,
    x: p.x,
    y: p.y,
    noiseSeedX: Math.random() * 1000,
    noiseSeedY: Math.random() * 1000,
  }));
}

export function buildZoneMesh(zone: ResolvedZoneConfig): ZoneMesh {
  const points = generatePoints({
    rect: zone.rect,
    polygonSize: zone.polygonSize,
    pointCount: zone.pointCount,
    maxPointCount: zone.effectiveMaxPointCount,
    clipPolygon: zone.clipPolygon,
    meshFit: zone.meshFit,
  });
  const triangles = triangulate(points);
  const fillPolygons = assignPolygonCellFills(
    triangles,
    zone.style.lineColor,
    zone.style.cellFill,
  );
  const polygons = mergePolygonsToTarget(
    points,
    triangles,
    zone.sidesMin,
    zone.sidesMax,
    zone.polygonSize,
  );
  let edges = buildEdges(polygons);
  const boundaryBand = getBoundaryBand(zone.meshFit?.boundaryInset ?? 0);
  edges = filterEdgesInsidePolygon(edges, points, zone.clipPolygon, { boundaryBand });
  edges = removeIsolatedEdges(edges);
  const filteredPolygons = rebuildPolygonsFromEdges(edges);
  const meshPolygons = filteredPolygons.length > 0 ? filteredPolygons : polygons;

  return {
    vertices: createVertices(points),
    edges,
    polygons: meshPolygons,
    fillPolygons,
    style: zone.style,
    animation: zone.animation,
    clipPolygon: zone.clipPolygon,
    meshFit: zone.meshFit,
  };
}
