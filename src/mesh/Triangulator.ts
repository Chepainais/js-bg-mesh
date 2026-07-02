import { Delaunay } from 'd3-delaunay';
import type { MeshPolygon, Point } from '../types';

export function triangulate(points: Point[]): MeshPolygon[] {
  if (points.length < 3) return [];

  const delaunay = Delaunay.from(
    points,
    (p: Point) => p.x,
    (p: Point) => p.y,
  );

  const polygons: MeshPolygon[] = [];
  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    polygons.push({
      vertices: [
        delaunay.triangles[i],
        delaunay.triangles[i + 1],
        delaunay.triangles[i + 2],
      ],
    });
  }

  return polygons;
}
