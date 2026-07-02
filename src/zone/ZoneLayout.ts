import type { Point, Rect, ZoneConfig, ZoneLayout, ResolvedZoneConfig, ResolvedMeshFit } from '../types';
import { DEFAULT_ANIMATION, DEFAULT_STYLE, DEFAULT_MESH_FIT_RECT, DEFAULT_MESH_FIT_POLYGON } from '../types';
import { polygonBoundingRect, scalePolygonToContainer, normalizeClipPolygon } from '../geometry/polygon';

export interface ResolvedLayout {
  rect: Rect;
  clipPolygon?: Point[];
}

export function resolveLayout(
  layout: ZoneLayout,
  containerWidth: number,
  containerHeight: number,
): ResolvedLayout {
  switch (layout.mode) {
    case 'pixel':
      return {
        rect: {
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
        },
      };
    case 'percent':
      return {
        rect: {
          x: (layout.x / 100) * containerWidth,
          y: (layout.y / 100) * containerHeight,
          width: (layout.width / 100) * containerWidth,
          height: (layout.height / 100) * containerHeight,
        },
      };
    case 'centered': {
      const width = (layout.widthPercent / 100) * containerWidth;
      const heightPercent = layout.heightPercent ?? 100;
      const height = (heightPercent / 100) * containerHeight;
      return {
        rect: {
          x: (containerWidth - width) / 2,
          y: (containerHeight - height) / 2,
          width,
          height,
        },
      };
    }
    case 'polygon': {
      const clipPolygon = normalizeClipPolygon(
        scalePolygonToContainer(
          layout.points,
          layout.unit,
          containerWidth,
          containerHeight,
        ),
      );
      return {
        rect: polygonBoundingRect(clipPolygon),
        clipPolygon,
      };
    }
  }
}

function resolveSides(polygonSides: ZoneConfig['polygonSides']): { min: number; max: number } {
  if (typeof polygonSides === 'number') {
    return { min: polygonSides, max: polygonSides };
  }
  return { min: polygonSides.min, max: polygonSides.max };
}

function mergeStyle(
  globalStyle: Partial<import('../types').MeshStyle> | undefined,
  zoneStyle: Partial<import('../types').MeshStyle> | undefined,
): Required<import('../types').MeshStyle> {
  const merged = {
    ...DEFAULT_STYLE,
    ...globalStyle,
    ...zoneStyle,
  };
  if (zoneStyle?.cellFill === undefined && globalStyle?.cellFill === undefined) {
    merged.cellFill = { min: 0, max: 0 };
  }
  return merged;
}

function mergeAnimation(
  globalAnimation: Partial<import('../types').AnimationConfig> | undefined,
  zoneAnimation: Partial<import('../types').AnimationConfig> | undefined,
): Required<import('../types').AnimationConfig> {
  return {
    ...DEFAULT_ANIMATION,
    ...globalAnimation,
    ...zoneAnimation,
  };
}

function resolveMeshFit(
  layout: ZoneLayout,
  meshFit?: import('../types').MeshFitConfig,
): ResolvedMeshFit {
  const isPolygon = layout.mode === 'polygon';
  const defaults = isPolygon ? DEFAULT_MESH_FIT_POLYGON : DEFAULT_MESH_FIT_RECT;
  return {
    boundaryInset: meshFit?.boundaryInset ?? defaults.boundaryInset,
    clipAnimation: meshFit?.clipAnimation ?? defaults.clipAnimation,
    autoSize: meshFit?.autoSize ?? defaults.autoSize,
  };
}

export function resolveZone(
  zone: ZoneConfig,
  containerWidth: number,
  containerHeight: number,
  globalStyle?: import('../types').MeshStyle,
  globalAnimation?: import('../types').AnimationConfig,
  globalMaxPointsPerZone?: number,
): ResolvedZoneConfig {
  const sides = resolveSides(zone.polygonSides);
  const effectiveMaxPointCount = zone.maxPointCount ?? globalMaxPointsPerZone;
  const resolved = resolveLayout(zone.layout, containerWidth, containerHeight);

  return {
    ...zone,
    rect: resolved.rect,
    clipPolygon: resolved.clipPolygon,
    sidesMin: Math.max(3, sides.min),
    sidesMax: Math.max(3, sides.max),
    effectiveMaxPointCount: effectiveMaxPointCount && effectiveMaxPointCount > 0
      ? effectiveMaxPointCount
      : undefined,
    meshFit: resolveMeshFit(zone.layout, zone.meshFit),
    style: mergeStyle(globalStyle, zone.style),
    animation: mergeAnimation(globalAnimation, zone.animation),
  };
}
