import type { Point, ZoneConfig } from '../../src/types';
import type { ImagePlacement } from './imagePlacement';

export interface DetectedRegion {
  id: string;
  color: { r: number; g: number; b: number; a: number };
  colorHex: string;
  area: number;
  points: Point[];
  enabled: boolean;
}

export interface MaskImportOptions {
  containerWidth: number;
  containerHeight: number;
  placement?: ImagePlacement;
  backgroundColor?: { r: number; g: number; b: number; a: number };
  minRegionArea?: number;
  simplifyTolerance?: number;
}

export interface MaskImportResult {
  regions: DetectedRegion[];
  sourceWidth: number;
  sourceHeight: number;
}

export interface ExportedZone extends ZoneConfig {
  _label?: string;
}
