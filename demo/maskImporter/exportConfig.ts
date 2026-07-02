import type { ZoneConfig } from '../../src/types';
import type { DetectedRegion } from './types';
import { roundPoint } from './simplify';

function rgbaFromHex(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function regionToZoneConfig(
  region: DetectedRegion,
  containerWidth: number,
  containerHeight: number,
): ZoneConfig | null {
  if (region.points.length < 3) return null;

  const percentPoints = region.points.map((p) =>
    roundPoint({
      x: (p.x / containerWidth) * 100,
      y: (p.y / containerHeight) * 100,
    }, 1),
  );

  const cellSize = Math.max(14, Math.min(60, Math.sqrt(region.area / 8)));

  return {
    layout: {
      mode: 'polygon' as const,
      unit: 'percent' as const,
      points: percentPoints,
    },
    polygonSides: { min: 3, max: 5 },
    polygonSize: { min: Math.round(cellSize * 0.7), max: Math.round(cellSize * 1.3) },
    meshFit: {
      boundaryInset: 0,
      clipAnimation: true,
      autoSize: true,
    },
    style: {
      lineColor: rgbaFromHex(region.colorHex, 0.2),
      dotColor: rgbaFromHex(region.colorHex, 0.5),
      lineWidth: 1,
      dotRadius: 2,
    },
  };
}

export function regionsToZoneConfigs(
  regions: DetectedRegion[],
  containerWidth: number,
  containerHeight: number,
): ZoneConfig[] {
  return regions
    .filter((r) => r.enabled)
    .map((region) => regionToZoneConfig(region, containerWidth, containerHeight))
    .filter((zone): zone is ZoneConfig => zone !== null);
}

function formatPoints(points: { x: number; y: number }[]): string {
  return points
    .map((p) => `          { x: ${p.x}, y: ${p.y} }`)
    .join(',\n');
}

export function exportIntegrationCode(
  zones: ZoneConfig[],
  fps = 30,
): string {
  const zoneBlocks = zones.map((zone, i) => {
    const layout = zone.layout;
    if (layout.mode !== 'polygon') return '';
    const style = zone.style ?? {};
    return `    {
      layout: {
        mode: 'polygon',
        unit: 'percent',
        points: [
${formatPoints(layout.points)},
        ],
      },
      polygonSides: ${JSON.stringify(zone.polygonSides)},
      polygonSize: ${JSON.stringify(zone.polygonSize)},
      meshFit: ${JSON.stringify(zone.meshFit ?? { boundaryInset: 0, clipAnimation: true, autoSize: true })},
      style: {
        lineColor: '${style.lineColor ?? 'rgba(255,255,255,0.2)'}',
        dotColor: '${style.dotColor ?? 'rgba(255,255,255,0.5)'}',
        lineWidth: ${style.lineWidth ?? 1},
        dotRadius: ${style.dotRadius ?? 2},
      },
    }`;
  }).filter(Boolean);

  return `BgMesh.init({
  container: '#hero',
  fps: ${fps},
  zones: [
${zoneBlocks.join(',\n')},
  ],
});`;
}
