import type { ZoneConfig } from '../src/types';
import type { ViewTransform } from '../src/types';
import { applyViewTransformToElement } from '../src/render/viewTransform';
import type { DetectedRegion } from './maskImporter/types';
import {
  importMaskFile,
  regionToZoneConfig,
  regionsToZoneConfigs,
  exportIntegrationCode,
  yieldToBrowser,
} from './maskImporter/index';
import { randomSampleFile } from './randomSample';

function getContainerSize(): { width: number; height: number } {
  const hero = document.getElementById('hero')!;
  const rect = hero.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

export interface MaskUiState {
  regions: DetectedRegion[];
  zoneConfigs: ZoneConfig[];
  usingImported: boolean;
}

let regions: DetectedRegion[] = [];
let usingImported = false;
let importedZoneConfigs: ZoneConfig[] = [];

export function getMaskState(): MaskUiState {
  return {
    regions,
    zoneConfigs: importedZoneConfigs,
    usingImported,
  };
}

export function isUsingImportedZones(): boolean {
  return usingImported;
}

export function getActiveZoneConfigs(): ZoneConfig[] {
  if (usingImported && importedZoneConfigs.length > 0) {
    return regions
      .map((region, index) => (
        region.enabled && importedZoneConfigs[index] ? importedZoneConfigs[index] : null
      ))
      .filter((zone): zone is ZoneConfig => zone !== null);
  }
  const { width, height } = getContainerSize();
  return regionsToZoneConfigs(regions, width, height);
}

export function getEnabledRegionIndices(): number[] {
  return regions
    .map((region, index) => (region.enabled ? index : -1))
    .filter((index) => index >= 0);
}

export function getHiddenRegions(): { index: number; region: DetectedRegion }[] {
  return regions
    .map((region, index) => (!region.enabled ? { index, region } : null))
    .filter((entry): entry is { index: number; region: DetectedRegion } => entry !== null);
}

export function getRegionIndexForVisibleZone(visibleIndex: number): number {
  return getEnabledRegionIndices()[visibleIndex] ?? -1;
}

export function getVisibleIndexForRegionIndex(regionIndex: number): number {
  return getEnabledRegionIndices().indexOf(regionIndex);
}

export function updateImportedZoneConfig(regionIndex: number, config: ZoneConfig): void {
  if (regionIndex < 0 || regionIndex >= importedZoneConfigs.length) return;
  importedZoneConfigs[regionIndex] = config;
}

export function updateAllImportedZoneConfigs(
  updater: (zone: ZoneConfig, regionIndex: number) => ZoneConfig,
): void {
  for (let i = 0; i < importedZoneConfigs.length; i++) {
    importedZoneConfigs[i] = updater(importedZoneConfigs[i], i);
  }
}

export function getImportedRegionCount(): number {
  return regions.length;
}

export function removeImportedZoneAt(visibleIndex: number): void {
  const regionIndex = getRegionIndexForVisibleZone(visibleIndex);
  if (regionIndex < 0) return;
  importedZoneConfigs.splice(regionIndex, 1);
  regions.splice(regionIndex, 1);
  if (regions.length === 0) {
    usingImported = false;
    importedZoneConfigs = [];
  }
}

export function resetMaskState(): void {
  regions = [];
  usingImported = false;
  importedZoneConfigs = [];
  setMaskButtons(false);
  setMaskOverlayControlsVisible(false);
  hideMaskOverlay();
  const fileInput = document.getElementById('maskFile') as HTMLInputElement | null;
  if (fileInput) fileInput.value = '';
  setStatus('Upload a color map or filled SVG to detect zones.');
}

export function getImportedRegion(regionIndex: number): DetectedRegion | undefined {
  if (!usingImported || regionIndex < 0 || regionIndex >= regions.length) return undefined;
  return regions[regionIndex];
}

export function getImportedRegionByVisibleIndex(visibleIndex: number): DetectedRegion | undefined {
  return getImportedRegion(getRegionIndexForVisibleZone(visibleIndex));
}

export function setImportedRegionEnabled(
  index: number,
  enabled: boolean,
  onApply: () => void,
): void {
  const region = regions[index];
  if (!region) return;
  region.enabled = enabled;
  drawMaskOverlay();
  applyImportedZones(onApply);
}

export function refreshMaskUi(): void {
  setMaskButtons(regions.length > 0);
  setMaskOverlayControlsVisible(regions.length > 0);
  drawMaskOverlay();
}

function setMaskOverlayVisible(visible: boolean): void {
  const checkbox = document.getElementById('showMaskOverlay') as HTMLInputElement | null;
  if (checkbox) checkbox.checked = visible;
  drawMaskOverlay();
}

export function hideMaskOverlay(): void {
  setMaskOverlayVisible(false);
}

function setMaskOverlayControlsVisible(visible: boolean): void {
  const label = document.querySelector('label[for="showMaskOverlay"]') as HTMLElement | null
    ?? document.getElementById('showMaskOverlay')?.closest('label') as HTMLElement | null;
  if (label) label.style.display = visible ? 'flex' : 'none';
}

function setMaskButtons(enabled: boolean): void {
  (document.getElementById('showExportCode') as HTMLButtonElement).disabled = !enabled;
  (document.getElementById('copyExportCode') as HTMLButtonElement).disabled = !enabled;
}

function buildIntegrationCode(): string {
  const zones = usingImported
    ? getActiveZoneConfigs()
    : regionsToZoneConfigs(regions, getContainerSize().width, getContainerSize().height);
  const fps = Number((document.getElementById('fps') as HTMLInputElement).value);
  return exportIntegrationCode(zones, fps);
}

async function copyIntegrationCode(): Promise<void> {
  const code = buildIntegrationCode();
  await navigator.clipboard.writeText(code);
  setStatus('Integration code copied to clipboard.', 'success');
}

function showIntegrationCodeDialog(): void {
  const dialog = document.getElementById('exportCodeDialog') as HTMLDialogElement;
  const textarea = document.getElementById('exportCodeText') as HTMLTextAreaElement;
  textarea.value = buildIntegrationCode();
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  textarea.focus();
  textarea.select();
}

function closeIntegrationCodeDialog(): void {
  const dialog = document.getElementById('exportCodeDialog') as HTMLDialogElement;
  if (dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

function mergeZoneConfigFromRegion(
  region: DetectedRegion,
  width: number,
  height: number,
  previous?: ZoneConfig,
): ZoneConfig | null {
  const fresh = regionToZoneConfig(region, width, height);
  if (!fresh) return previous ?? null;
  if (!previous) return fresh;
  return {
    ...fresh,
    polygonSides: previous.polygonSides,
    polygonSize: previous.polygonSize,
    pointCount: previous.pointCount,
    meshFit: previous.meshFit,
    style: previous.style,
    animation: previous.animation,
  };
}

function applyImportedZones(onApply: () => void): void {
  const { width, height } = getContainerSize();
  importedZoneConfigs = regions
    .map((region, index) => mergeZoneConfigFromRegion(
      region,
      width,
      height,
      importedZoneConfigs[index],
    ))
    .filter((zone): zone is ZoneConfig => zone !== null);
  usingImported = regions.length > 0;
  if (!usingImported) return;
  onApply();
}

function readViewTransformFromControls(): ViewTransform | undefined {
  const zoom = document.getElementById('zoom') as HTMLInputElement | null;
  const panX = document.getElementById('panX') as HTMLInputElement | null;
  const panY = document.getElementById('panY') as HTMLInputElement | null;
  if (!zoom) return undefined;
  const { width, height } = getContainerSize();
  return {
    scale: Number(zoom.value) / 100,
    translateX: panX ? (Number(panX.value) / 100) * width : 0,
    translateY: panY ? (Number(panY.value) / 100) * height : 0,
  };
}

export function drawMaskOverlay(viewTransform?: ViewTransform): void {
  const canvas = document.getElementById('maskOverlay') as HTMLCanvasElement;
  const { width, height } = getContainerSize();
  if (width <= 0 || height <= 0) return;

  const transform = viewTransform ?? readViewTransformFromControls();
  const show = (document.getElementById('showMaskOverlay') as HTMLInputElement).checked;
  canvas.width = width;
  canvas.height = height;
  applyViewTransformToElement(canvas, transform, width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  if (!show || regions.length === 0) return;

  for (const region of regions) {
    if (!region.enabled || region.points.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(region.points[0].x, region.points[0].y);
    for (let i = 1; i < region.points.length; i++) {
      ctx.lineTo(region.points[i].x, region.points[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = region.colorHex;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = region.colorHex;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function setStatus(message: string, tone: 'default' | 'error' | 'success' = 'default'): void {
  const el = document.getElementById('maskStatus')!;
  el.textContent = message;
  el.classList.remove('is-error', 'is-success');
  if (tone === 'error') el.classList.add('is-error');
  if (tone === 'success') el.classList.add('is-success');
}

function setMaskLoading(loading: boolean, message = 'Processing mask...'): void {
  const loadingEl = document.getElementById('maskLoading');
  const loadingText = document.getElementById('maskLoadingText');
  const heroLoadingEl = document.getElementById('maskHeroLoading');
  const heroLoadingText = document.getElementById('maskHeroLoadingText');
  const section = document.getElementById('maskSection');
  const fileInput = document.getElementById('maskFile') as HTMLInputElement | null;
  const sampleButtons = document.querySelectorAll<HTMLButtonElement>('.sample-buttons button');

  if (loadingEl) loadingEl.hidden = !loading;
  if (loadingText) loadingText.textContent = message;
  if (heroLoadingEl) heroLoadingEl.hidden = !loading;
  if (heroLoadingText) heroLoadingText.textContent = message;
  if (section) section.classList.toggle('is-mask-loading', loading);
  document.body.classList.toggle('is-mask-processing', loading);
  if (fileInput) fileInput.disabled = loading;
  sampleButtons.forEach((btn) => { btn.disabled = loading; });
  if (loading) {
    setMaskButtons(false);
    setStatus(message);
  }
}

async function handleMaskFile(file: File, onApply: () => void): Promise<void> {
  setMaskLoading(true, `Loading: ${file.name}...`);
  await yieldToBrowser();
  try {
    setMaskLoading(true, `Processing: ${file.name}...`);
    const { width, height } = getContainerSize();
    const result = await importMaskFile(file, width, height);
    regions = result.regions;
    usingImported = false;
    importedZoneConfigs = [];
    refreshMaskUi();
    setMaskOverlayVisible(regions.length > 0);

    if (regions.length > 0) {
      applyImportedZones(onApply);
      const visibleCount = getEnabledRegionIndices().length;
      setStatus(`Applied ${visibleCount} polygon zones.`, 'success');
    } else {
      setStatus('No zones detected. Use flat filled regions with distinct colors.', 'error');
    }
  } catch (err) {
    regions = [];
    refreshMaskUi();
    hideMaskOverlay();
    const message = err instanceof Error ? err.message : 'Unknown error';
    setStatus(`Mask processing failed: ${message}`, 'error');
  } finally {
    setMaskLoading(false);
  }
}

async function loadSample(path: string, filename: string, onApply: () => void): Promise<void> {
  const res = await fetch(path);
  const blob = await res.blob();
  const type = filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  const file = new File([blob], filename, { type });
  await handleMaskFile(file, onApply);
}

export function initMaskUi(onApply: () => void): void {
  const fileInput = document.getElementById('maskFile') as HTMLInputElement;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void handleMaskFile(file, onApply);
  });

  document.getElementById('loadSample3')!.addEventListener('click', () =>
    void loadSample('./samples/logo-3zones.svg', 'logo-3zones.svg', onApply));
  document.getElementById('loadSample5')!.addEventListener('click', () =>
    void loadSample('./samples/sample-pentagons.svg', 'sample-pentagons.svg', onApply));
  document.getElementById('loadSample4')!.addEventListener('click', () =>
    void loadSample('./samples/sample-mosaic.svg', 'sample-mosaic.svg', onApply));
  document.getElementById('loadSampleBars')!.addEventListener('click', () =>
    void loadSample('./samples/sample-bars.svg', 'sample-bars.svg', onApply));
  document.getElementById('loadSampleRandom')!.addEventListener('click', () => {
    const { width, height } = getContainerSize();
    void handleMaskFile(randomSampleFile(width, height), onApply);
  });

  document.getElementById('showExportCode')!.addEventListener('click', () => {
    showIntegrationCodeDialog();
  });

  document.getElementById('copyExportCode')!.addEventListener('click', () => {
    void copyIntegrationCode();
  });

  document.getElementById('copyExportCodeFromDialog')!.addEventListener('click', () => {
    void copyIntegrationCode();
  });

  document.getElementById('closeExportCodeDialog')!.addEventListener('click', closeIntegrationCodeDialog);
  document.getElementById('closeExportCodeDialogBtn')!.addEventListener('click', closeIntegrationCodeDialog);
  document.getElementById('exportCodeDialog')!.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeIntegrationCodeDialog();
  });

  document.getElementById('showMaskOverlay')!.addEventListener('change', drawMaskOverlay);
  setMaskOverlayControlsVisible(false);
  hideMaskOverlay();
  window.addEventListener('resize', () => {
    drawMaskOverlay();
    if (usingImported) {
      applyImportedZones(onApply);
    }
  });
}
