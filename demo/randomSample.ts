import { Delaunay } from 'd3-delaunay';

const PALETTE = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#e91e63',
  '#00bcd4',
  '#ff5722',
  '#8bc34a',
];

type Point = [number, number];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomSeeds(count: number, width: number, height: number): Point[] {
  const pad = Math.min(width, height) * 0.05;
  const minDist = Math.min(width, height) / Math.max(count, 2) * 0.42;
  const seeds: Point[] = [];
  const maxAttempts = count * 120;

  for (let attempt = 0; attempt < maxAttempts && seeds.length < count; attempt++) {
    const x = pad + Math.random() * (width - pad * 2);
    const y = pad + Math.random() * (height - pad * 2);
    const farEnough = seeds.every(([sx, sy]) => Math.hypot(x - sx, y - sy) >= minDist);
    if (farEnough) seeds.push([x, y]);
  }

  while (seeds.length < count) {
    seeds.push([
      pad + Math.random() * (width - pad * 2),
      pad + Math.random() * (height - pad * 2),
    ]);
  }

  return seeds;
}

function simplifyCellRing(cell: Point[], maxVertices: number): Point[] {
  if (cell.length <= maxVertices) return cell;

  const step = cell.length / maxVertices;
  const simplified: Point[] = [];
  for (let i = 0; i < maxVertices; i++) {
    const index = Math.min(cell.length - 1, Math.floor(i * step));
    simplified.push(cell[index]);
  }
  return simplified;
}

function pointsToSvgAttr(points: Point[]): string {
  return points.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');
}

export function buildRandomSampleSvg(width = 400, height = 300): string {
  const zoneCount = 2 + Math.floor(Math.random() * 3);
  const colors = shuffle(PALETTE).slice(0, zoneCount);
  const seeds = randomSeeds(zoneCount, width, height);
  const delaunay = Delaunay.from(seeds);
  const voronoi = delaunay.voronoi([0, 0, width, height]);

  const polygons: string[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell || cell.length < 3) continue;

    const vertexCount = 5 + Math.floor(Math.random() * 4);
    const ring = simplifyCellRing(cell, vertexCount);
    polygons.push(
      `  <polygon points="${pointsToSvgAttr(ring)}" fill="${colors[i]}"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#0f1117"/>
${polygons.join('\n')}
</svg>`;
}

export function randomSampleFile(width = 400, height = 300): File {
  const svg = buildRandomSampleSvg(width, height);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return new File([blob], `random-mask-${Date.now()}.svg`, { type: 'image/svg+xml' });
}
