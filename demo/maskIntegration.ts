import type { ZoneConfig, ZoneLayout } from '../../src/index';
import {
  initMaskUi,
  drawMaskOverlay,
  isUsingImportedZones,
  getActiveZoneConfigs,
  getMaskState,
} from './maskUi';

export { initMaskUi, drawMaskOverlay, isUsingImportedZones, getActiveZoneConfigs, getMaskState };

export function syncImportedZoneFromForm(
  zone: ZoneConfig,
  form: {
    sidesMin: number;
    sidesMax: number;
    sizeMin: number;
    sizeMax: number;
    pointCount: number;
    lineWidth: number;
    lineColor: string;
    lineOpacity: number;
    dotColor: string;
    dotOpacity: number;
    speed: number;
    amplitude: number;
    boundaryInset: number;
    clipAnimation: boolean;
    cellFillMin: number;
    cellFillMax: number;
  },
  hexToRgba: (hex: string, opacity: number) => string,
): ZoneConfig {
  return {
    ...zone,
    layout: zone.layout,
    polygonSides: { min: form.sidesMin, max: form.sidesMax },
    polygonSize: { min: form.sizeMin, max: form.sizeMax },
    pointCount: form.pointCount > 0 ? form.pointCount : undefined,
    meshFit: {
      boundaryInset: form.boundaryInset,
      clipAnimation: form.clipAnimation,
      autoSize: zone.meshFit?.autoSize ?? zone.layout.mode === 'polygon',
    },
    style: {
      lineColor: hexToRgba(form.lineColor, form.lineOpacity / 100),
      dotColor: hexToRgba(form.dotColor, form.dotOpacity / 100),
      dotRadius: 2,
      lineWidth: form.lineWidth,
      cellFill: form.cellFillMax > 0
        ? { min: form.cellFillMin, max: form.cellFillMax }
        : undefined,
    },
    animation: {
      speed: form.speed / 100,
      amplitude: form.amplitude,
    },
  };
}

export function isPolygonLayout(layout: ZoneLayout): boolean {
  return layout.mode === 'polygon';
}
