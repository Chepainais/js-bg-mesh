import type { Point } from '../../src/types';

export interface ImagePlacement {
  analysisWidth: number;
  analysisHeight: number;
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
}

export function computeImagePlacement(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
  maxAnalysisSize = 1024,
): ImagePlacement {
  const safeImgW = Math.max(1, imageWidth);
  const safeImgH = Math.max(1, imageHeight);
  const safeContainerW = Math.max(1, containerWidth);
  const safeContainerH = Math.max(1, containerHeight);

  const containerScale = Math.min(safeContainerW / safeImgW, safeContainerH / safeImgH);
  const drawWidth = safeImgW * containerScale;
  const drawHeight = safeImgH * containerScale;
  const offsetX = (safeContainerW - drawWidth) / 2;
  const offsetY = (safeContainerH - drawHeight) / 2;

  const analysisScale = Math.min(maxAnalysisSize / safeImgW, maxAnalysisSize / safeImgH, 1);
  const analysisWidth = Math.max(1, Math.round(safeImgW * analysisScale));
  const analysisHeight = Math.max(1, Math.round(safeImgH * analysisScale));

  return {
    analysisWidth,
    analysisHeight,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight,
  };
}

export function mapAnalysisPointToContainer(
  x: number,
  y: number,
  placement: ImagePlacement,
): Point {
  return {
    x: placement.offsetX + (x / placement.analysisWidth) * placement.drawWidth,
    y: placement.offsetY + (y / placement.analysisHeight) * placement.drawHeight,
  };
}

export function mapContainerPointToAnalysis(
  x: number,
  y: number,
  placement: ImagePlacement,
): Point {
  const localX = x - placement.offsetX;
  const localY = y - placement.offsetY;
  return {
    x: (localX / placement.drawWidth) * placement.analysisWidth,
    y: (localY / placement.drawHeight) * placement.analysisHeight,
  };
}
