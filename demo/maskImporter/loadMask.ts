import type { ImagePlacement } from './imagePlacement';
import { computeImagePlacement } from './imagePlacement';

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function imageToImageData(
  img: HTMLImageElement,
  width: number,
  height: number,
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export interface AnalysisImageResult {
  imageData: ImageData;
  placement: ImagePlacement;
  sourceWidth: number;
  sourceHeight: number;
}

export function imageToAnalysisImageData(
  img: HTMLImageElement,
  containerWidth: number,
  containerHeight: number,
  maxAnalysisSize = 1024,
): AnalysisImageResult {
  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  const placement = computeImagePlacement(
    sourceWidth,
    sourceHeight,
    containerWidth,
    containerHeight,
    maxAnalysisSize,
  );
  const imageData = imageToImageData(img, placement.analysisWidth, placement.analysisHeight);

  return {
    imageData,
    placement,
    sourceWidth,
    sourceHeight,
  };
}

export function svgToImageData(svgText: string, width: number, height: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(imageToImageData(img, width, height));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render SVG'));
    };
    img.src = url;
  });
}
