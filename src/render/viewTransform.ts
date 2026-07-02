import type { ViewTransform } from '../types';

export function applyViewTransformToElement(
  element: HTMLElement,
  viewTransform: ViewTransform | undefined,
  width: number,
  height: number,
): void {
  const scale = viewTransform?.scale ?? 1;
  const translateX = viewTransform?.translateX ?? 0;
  const translateY = viewTransform?.translateY ?? 0;
  const noScale = Math.abs(scale - 1) < 0.0001;
  const noTranslate = Math.abs(translateX) < 0.0001 && Math.abs(translateY) < 0.0001;

  if (noScale && noTranslate) {
    element.style.transform = '';
    element.style.transformOrigin = '';
    return;
  }

  const originX = viewTransform?.originX ?? width / 2;
  const originY = viewTransform?.originY ?? height / 2;
  element.style.transformOrigin = `${(originX / width) * 100}% ${(originY / height) * 100}%`;

  const parts: string[] = [];
  if (!noTranslate) {
    parts.push(`translate(${translateX}px, ${translateY}px)`);
  }
  if (!noScale) {
    parts.push(`scale(${scale})`);
  }
  element.style.transform = parts.join(' ');
}
