import type { MeshPolygon } from '../types';

function parseColorRgb(color: string): { r: number; g: number; b: number } {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return {
      r: parseInt(hex[1].slice(0, 2), 16),
      g: parseInt(hex[1].slice(2, 4), 16),
      b: parseInt(hex[1].slice(4, 6), 16),
    };
  }
  const rgba = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgba) {
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) };
  }
  return { r: 255, g: 255, b: 255 };
}

export function assignPolygonCellFills(
  polygons: MeshPolygon[],
  lineColor: string,
  cellFill?: { min: number; max: number },
): MeshPolygon[] {
  if (!cellFill) return polygons;
  const lo = Math.min(cellFill.min, cellFill.max);
  const hi = Math.max(cellFill.min, cellFill.max);
  if (hi <= 0) return polygons;

  const rgb = parseColorRgb(lineColor);
  const minOpacity = lo / 100;
  const maxOpacity = hi / 100;

  return polygons.map((poly) => {
    const opacity = minOpacity === maxOpacity
      ? minOpacity
      : minOpacity + Math.random() * (maxOpacity - minOpacity);
    return {
      ...poly,
      fillColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`,
    };
  });
}
