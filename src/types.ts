export interface MeshStyle {
  lineColor?: string;
  dotColor?: string;
  lineWidth?: number;
  dotRadius?: number;
  fillColor?: string;
  /** Per-cell fill using line color RGB. min/max opacity 0-100; random per cell when min < max */
  cellFill?: { min: number; max: number };
}

export interface AnimationConfig {
  speed?: number;
  amplitude?: number;
}

/** Scales and pans the rendered mesh (CSS transform on canvas). */
export interface ViewTransform {
  /** Scale factor. 1 = normal size */
  scale?: number;
  /** Origin X in container pixels. Default: container center */
  originX?: number;
  /** Origin Y in container pixels. Default: container center */
  originY?: number;
  /** Horizontal pan in container pixels */
  translateX?: number;
  /** Vertical pan in container pixels */
  translateY?: number;
}

/** Controls how mesh fits inside polygon zones */
export interface MeshFitConfig {
  /** Min distance from polygon edge for mesh points (px). Default 6 for polygon zones */
  boundaryInset?: number;
  /** Keep animated points inside polygon. Default true for polygon zones */
  clipAnimation?: boolean;
  /** Auto-calculate polygonSize from polygon shape area. Default true for polygon zones */
  autoSize?: boolean;
}

export interface ResolvedMeshFit {
  boundaryInset: number;
  clipAnimation: boolean;
  autoSize: boolean;
}

export type ZoneLayout =
  | { mode: 'percent'; x: number; y: number; width: number; height: number }
  | { mode: 'pixel'; x: number; y: number; width: number; height: number }
  | { mode: 'centered'; widthPercent: number; heightPercent?: number }
  | { mode: 'polygon'; points: Point[]; unit: 'percent' | 'pixel' };

export interface ZoneConfig {
  layout: ZoneLayout;
  polygonSides: number | { min: number; max: number };
  polygonSize: { min: number; max: number };
  pointCount?: number;
  maxPointCount?: number;
  style?: MeshStyle;
  animation?: AnimationConfig;
  meshFit?: MeshFitConfig;
}

export interface BgMeshConfig {
  container: string | HTMLElement;
  globalStyle?: MeshStyle;
  animation?: AnimationConfig;
  /** Frames per second for canvas redraw. 0 = static mesh (no animation loop). Default: 30 */
  fps?: number;
  /** Optional global cap on auto-calculated points per zone */
  maxPointsPerZone?: number;
  /** Global zoom applied to the whole mesh (all zones together) */
  viewTransform?: ViewTransform;
  zones: ZoneConfig[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface MeshVertex {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  noiseSeedX: number;
  noiseSeedY: number;
}

export interface MeshEdge {
  a: number;
  b: number;
}

export interface MeshPolygon {
  vertices: number[];
  fillColor?: string;
}

export interface ZoneMesh {
  vertices: MeshVertex[];
  edges: MeshEdge[];
  polygons: MeshPolygon[];
  /** Filled mesh cells (usually Delaunay triangles) */
  fillPolygons?: MeshPolygon[];
  style: Required<MeshStyle>;
  animation: Required<AnimationConfig>;
  clipPolygon?: Point[];
  meshFit?: ResolvedMeshFit;
}

export interface ResolvedZoneConfig extends ZoneConfig {
  rect: Rect;
  clipPolygon?: Point[];
  sidesMin: number;
  sidesMax: number;
  effectiveMaxPointCount?: number;
  meshFit: ResolvedMeshFit;
  style: Required<MeshStyle>;
  animation: Required<AnimationConfig>;
}

export const DEFAULT_STYLE: Required<MeshStyle> = {
  lineColor: 'rgba(255, 255, 255, 0.2)',
  dotColor: 'rgba(255, 255, 255, 0.5)',
  lineWidth: 1,
  dotRadius: 2,
  fillColor: 'transparent',
  cellFill: { min: 0, max: 0 },
};

export const DEFAULT_ANIMATION: Required<AnimationConfig> = {
  speed: 0.3,
  amplitude: 8,
};

export const DEFAULT_FPS = 30;

export const DEFAULT_MESH_FIT_RECT: ResolvedMeshFit = {
  boundaryInset: 0,
  clipAnimation: false,
  autoSize: false,
};

export const DEFAULT_MESH_FIT_POLYGON: ResolvedMeshFit = {
  boundaryInset: 6,
  clipAnimation: true,
  autoSize: true,
};
