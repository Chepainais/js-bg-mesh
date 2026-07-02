import type { MaskImportResult } from './types';
import { loadImageFile, readFileAsText, svgToImageData, imageToAnalysisImageData } from './loadMask';
import { detectRegionsFromImageData } from './detectRegions';
import { detectRegionsFromSvg } from './parseSvg';

export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function importMaskFile(
  file: File,
  containerWidth: number,
  containerHeight: number,
): Promise<MaskImportResult> {
  const isSvg = file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg');

  if (isSvg) {
    const svgText = await readFileAsText(file);
    await yieldToBrowser();
    const svgRegions = detectRegionsFromSvg(svgText, containerWidth, containerHeight);
    if (svgRegions.length > 0) {
      return {
        regions: svgRegions,
        sourceWidth: containerWidth,
        sourceHeight: containerHeight,
      };
    }
    const imageData = await svgToImageData(svgText, containerWidth, containerHeight);
    await yieldToBrowser();
    return {
      regions: detectRegionsFromImageData(imageData, {
        containerWidth,
        containerHeight,
      }),
      sourceWidth: containerWidth,
      sourceHeight: containerHeight,
    };
  }

  const img = await loadImageFile(file);
  await yieldToBrowser();
  const { imageData, placement, sourceWidth, sourceHeight } = imageToAnalysisImageData(
    img,
    containerWidth,
    containerHeight,
  );
  await yieldToBrowser();
  return {
    regions: detectRegionsFromImageData(imageData, {
      containerWidth,
      containerHeight,
      placement,
    }),
    sourceWidth,
    sourceHeight,
  };
}

export { regionToZoneConfig, regionsToZoneConfigs, exportIntegrationCode } from './exportConfig';
export type { DetectedRegion, MaskImportResult } from './types';
