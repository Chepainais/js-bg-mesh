import { BgMesh } from '../src/index';
import type { BgMeshConfig, ZoneConfig, ZoneLayout, ViewTransform, Point } from '../src/index';
import {
  initMaskUi,
  drawMaskOverlay,
  isUsingImportedZones,
  getActiveZoneConfigs,
  updateImportedZoneConfig,
  updateAllImportedZoneConfigs,
  removeImportedZoneAt,
  resetMaskState,
  refreshMaskUi,
  getImportedRegionByVisibleIndex,
  getRegionIndexForVisibleZone,
  getVisibleIndexForRegionIndex,
  getHiddenRegions,
  setImportedRegionEnabled,
} from './maskUi';
import { syncImportedZoneFromForm } from './maskIntegration';
import { flashZonePolygon } from './zoneHighlight';

type LayoutMode = 'centered' | 'percent' | 'pixel' | 'polygon';

interface ZoneState {
  layoutMode: LayoutMode;
  posX: number;
  posY: number;
  widthPercent: number;
  heightPercent: number;
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
  cellFillMin: number;
  cellFillMax: number;
}

const ZONE_COLORS = ['#ffffff', '#64b4ff', '#ff6b9d', '#7ee787', '#f0b429', '#b392f0'];

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function parseRgbaColor(color: string): { hex: string; opacity: number } {
  const hexMatch = color.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    return { hex: `#${hexMatch[1].toLowerCase()}`, opacity: 100 };
  }
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i);
  if (!match) {
    return { hex: '#ffffff', opacity: 20 };
  }
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const a = match[4] !== undefined ? Number(match[4]) : 1;
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  return { hex, opacity: Math.round(a * 100) };
}

function colorToTabBorder(color: string): string {
  if (color.startsWith('#')) return color;
  return parseRgbaColor(color).hex;
}

function getVal(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement;
}

function getSelect(id: string): HTMLSelectElement {
  return document.getElementById(id) as HTMLSelectElement;
}

function createDefaultZoneState(index: number): ZoneState {
  const color = ZONE_COLORS[index % ZONE_COLORS.length];
  const base: ZoneState = {
    layoutMode: index === 0 ? 'centered' : 'percent',
    posX: 5 + index * 12,
    posY: 10,
    widthPercent: index === 0 ? 30 : 35,
    heightPercent: index === 0 ? 100 : 80,
    sidesMin: 3,
    sidesMax: index === 0 ? 5 : 4,
    sizeMin: index === 0 ? 30 : 25,
    sizeMax: index === 0 ? 80 : 60,
    pointCount: 0,
    lineWidth: 1,
    lineColor: color,
    lineOpacity: 15 + index * 5,
    dotColor: color,
    dotOpacity: 40 + index * 10,
    speed: 30,
    amplitude: 8,
    cellFillMin: 0,
    cellFillMax: 0,
  };
  return base;
}

const zoneStates: ZoneState[] = [createDefaultZoneState(0)];
let activeZoneIndex = 0;

const instance = BgMesh.init({
  container: '#hero',
  fps: 30,
  zones: [],
});

function getGlobalFps(): number {
  return Number(getVal('fps').value);
}

function getGlobalMaxPoints(): number | undefined {
  const val = Number(getVal('maxPoints').value);
  return val > 0 ? val : undefined;
}

function getGlobalViewTransform(): ViewTransform {
  const hero = document.getElementById('hero')!;
  const { width, height } = hero.getBoundingClientRect();
  const panX = Number(getVal('panX').value);
  const panY = Number(getVal('panY').value);
  return {
    scale: Number(getVal('zoom').value) / 100,
    translateX: (panX / 100) * width,
    translateY: (panY / 100) * height,
  };
}

interface GlobalStyleValues {
  speed: number;
  amplitude: number;
  lineWidth: number;
  lineOpacity: number;
  dotOpacity: number;
  sidesMin: number;
  sidesMax: number;
  cellFillMin: number;
  cellFillMax: number;
}

function readGlobalStyleValues(): GlobalStyleValues {
  const sidesMin = Number(getVal('globalSidesMin').value);
  const cellFillMin = Number(getVal('globalCellFillMin').value);
  return {
    speed: Number(getVal('globalSpeed').value),
    amplitude: Number(getVal('globalAmplitude').value),
    lineWidth: Number(getVal('globalLineWidth').value),
    lineOpacity: Number(getVal('globalLineOpacity').value),
    dotOpacity: Number(getVal('globalDotOpacity').value),
    sidesMin,
    sidesMax: Math.max(sidesMin, Number(getVal('globalSidesMax').value)),
    cellFillMin,
    cellFillMax: Math.max(cellFillMin, Number(getVal('globalCellFillMax').value)),
  };
}

function applyGlobalStyleToZone(zone: ZoneConfig, global: GlobalStyleValues): ZoneConfig {
  const line = parseRgbaColor(zone.style?.lineColor ?? 'rgba(255,255,255,0.2)');
  const dot = parseRgbaColor(zone.style?.dotColor ?? 'rgba(255,255,255,0.5)');
  return {
    ...zone,
    polygonSides: { min: global.sidesMin, max: global.sidesMax },
    style: {
      ...zone.style,
      lineWidth: global.lineWidth,
      lineColor: hexToRgba(line.hex, global.lineOpacity / 100),
      dotColor: hexToRgba(dot.hex, global.dotOpacity / 100),
      dotRadius: zone.style?.dotRadius ?? 2,
      cellFill: global.cellFillMax > 0
        ? { min: global.cellFillMin, max: global.cellFillMax }
        : undefined,
    },
    animation: {
      ...zone.animation,
      speed: global.speed / 100,
      amplitude: global.amplitude,
    },
  };
}

function applyGlobalStyleToAllZones(): void {
  const global = readGlobalStyleValues();
  if (isUsingImportedZones()) {
    updateAllImportedZoneConfigs((zone) => applyGlobalStyleToZone(zone, global));
  } else {
    for (const state of zoneStates) {
      state.speed = global.speed;
      state.amplitude = global.amplitude;
      state.lineWidth = global.lineWidth;
      state.lineOpacity = global.lineOpacity;
      state.dotOpacity = global.dotOpacity;
      state.sidesMin = global.sidesMin;
      state.sidesMax = global.sidesMax;
      state.cellFillMin = global.cellFillMin;
      state.cellFillMax = global.cellFillMax;
    }
  }
  if (getZoneCount() > 0) {
    loadStateIntoForm(activeZoneIndex);
  }
  scheduleGeometryUpdate();
}

function syncGlobalSlidersFromZone(
  speed: number,
  amplitude: number,
  lineWidth: number,
  lineOpacity: number,
  dotOpacity: number,
  sidesMin: number,
  sidesMax: number,
  cellFillMin: number,
  cellFillMax: number,
): void {
  getVal('globalSpeed').value = String(speed);
  getVal('globalAmplitude').value = String(amplitude);
  getVal('globalLineWidth').value = String(lineWidth);
  getVal('globalLineOpacity').value = String(lineOpacity);
  getVal('globalDotOpacity').value = String(dotOpacity);
  getVal('globalSidesMin').value = String(sidesMin);
  getVal('globalSidesMax').value = String(sidesMax);
  getVal('globalCellFillMin').value = String(cellFillMin);
  getVal('globalCellFillMax').value = String(cellFillMax);
  document.getElementById('globalSpeedVal')!.textContent = (speed / 100).toFixed(1);
  document.getElementById('globalAmplitudeVal')!.textContent = String(amplitude);
  document.getElementById('globalLineWidthVal')!.textContent = String(lineWidth);
  document.getElementById('globalLineOpacityVal')!.textContent = `${lineOpacity}%`;
  document.getElementById('globalDotOpacityVal')!.textContent = `${dotOpacity}%`;
  document.getElementById('globalSidesMinVal')!.textContent = String(sidesMin);
  document.getElementById('globalSidesMaxVal')!.textContent = String(sidesMax);
  document.getElementById('globalCellFillMinVal')!.textContent = `${cellFillMin}%`;
  document.getElementById('globalCellFillMaxVal')!.textContent = `${cellFillMax}%`;
}

function updateZoneControlsSummary(): void {
  const summary = document.getElementById('zoneControlsSummary')!;
  summary.textContent = getZoneCount() > 0
    ? `Zone ${activeZoneIndex + 1} parameters`
    : 'Zone parameters';
}

function getZoneHighlightShape(visibleIndex: number): { points: Point[]; color: string } | null {
  if (isUsingImportedZones()) {
    const region = getImportedRegionByVisibleIndex(visibleIndex);
    if (!region || region.points.length < 3) return null;
    return { points: region.points, color: region.colorHex };
  }

  const state = zoneStates[visibleIndex];
  if (!state) return null;
  const hero = document.getElementById('hero')!;
  const { width, height } = hero.getBoundingClientRect();
  let x = 0;
  let y = 0;
  let w = 0;
  let h = 0;

  if (state.layoutMode === 'centered') {
    w = (state.widthPercent / 100) * width;
    h = (state.heightPercent / 100) * height;
    x = (width - w) / 2;
    y = (height - h) / 2;
  } else if (state.layoutMode === 'percent') {
    x = (state.posX / 100) * width;
    y = (state.posY / 100) * height;
    w = (state.widthPercent / 100) * width;
    h = (state.heightPercent / 100) * height;
  } else {
    w = (state.widthPercent / 100) * width;
    h = (state.heightPercent / 100) * height;
    x = (width - w) / 2;
    y = (height - h) / 2;
  }

  return {
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    color: state.lineColor,
  };
}

function flashActiveZoneHighlight(): void {
  const shape = getZoneHighlightShape(activeZoneIndex);
  if (!shape) return;
  flashZonePolygon(shape.points, shape.color, getGlobalViewTransform());
}

function buildLayout(state: ZoneState): ZoneLayout {
  if (state.layoutMode === 'centered') {
    return {
      mode: 'centered',
      widthPercent: state.widthPercent,
      heightPercent: state.heightPercent,
    };
  }
  if (state.layoutMode === 'percent') {
    return {
      mode: 'percent',
      x: state.posX,
      y: state.posY,
      width: state.widthPercent,
      height: state.heightPercent,
    };
  }
  const hero = document.getElementById('hero')!;
  const rect = hero.getBoundingClientRect();
  const w = (state.widthPercent / 100) * rect.width;
  const h = (state.heightPercent / 100) * rect.height;
  return {
    mode: 'pixel',
    x: (rect.width - w) / 2,
    y: (rect.height - h) / 2,
    width: w,
    height: h,
  };
}

function stateToZoneConfig(state: ZoneState): ZoneConfig {
  return {
    layout: buildLayout(state),
    polygonSides: { min: state.sidesMin, max: state.sidesMax },
    polygonSize: { min: state.sizeMin, max: state.sizeMax },
    pointCount: state.pointCount > 0 ? state.pointCount : undefined,
    style: {
      lineColor: hexToRgba(state.lineColor, state.lineOpacity / 100),
      dotColor: hexToRgba(state.dotColor, state.dotOpacity / 100),
      dotRadius: 2,
      lineWidth: state.lineWidth,
      cellFill: state.cellFillMax > 0
        ? { min: state.cellFillMin, max: state.cellFillMax }
        : undefined,
    },
    animation: {
      speed: state.speed / 100,
      amplitude: state.amplitude,
    },
  };
}

function getZoneCount(): number {
  if (isUsingImportedZones()) {
    return getActiveZoneConfigs().length;
  }
  return zoneStates.length;
}

function getZonesForMesh(): ZoneConfig[] {
  if (isUsingImportedZones()) {
    return getActiveZoneConfigs();
  }
  return zoneStates.map(stateToZoneConfig);
}

function updateMesh(): void {
  instance.update({
    fps: getGlobalFps(),
    maxPointsPerZone: getGlobalMaxPoints(),
    viewTransform: getGlobalViewTransform(),
    zones: getZonesForMesh(),
  });
  drawMaskOverlay(getGlobalViewTransform());
}

let geometryTimer = 0;
let tabsDirty = false;

function scheduleGeometryUpdate(): void {
  readFormIntoState(activeZoneIndex);
  tabsDirty = true;
  clearTimeout(geometryTimer);
  geometryTimer = window.setTimeout(() => {
    if (tabsDirty) {
      renderZoneTabs();
      tabsDirty = false;
    }
    updateMesh();
  }, 200);
}

function applyStyleUpdate(): void {
  readFormIntoState(activeZoneIndex);
  tabsDirty = true;
  renderZoneTabs();
  tabsDirty = false;
  updateMesh();
}

function updateLayoutFieldsVisibility(): void {
  const mode = getSelect('layoutMode').value;
  const percentFields = document.querySelectorAll<HTMLElement>('.field-percent');
  const rectControls = document.getElementById('rectControls')!;
  const polygonInfo = document.getElementById('polygonInfo')!;
  const boundaryLabel = document.getElementById('boundaryInsetLabel')!;
  const clipLabel = document.getElementById('clipAnimationLabel')!;

  const isPolygon = mode === 'polygon' || isUsingImportedZones();
  rectControls.style.display = isPolygon ? 'none' : 'block';
  polygonInfo.hidden = !isPolygon;
  boundaryLabel.classList.toggle('visible', isPolygon);
  clipLabel.classList.toggle('visible', isPolygon);
  percentFields.forEach((el) => {
    el.style.display = mode === 'percent' ? 'flex' : 'none';
  });
}

function readMeshFitFromForm(): { boundaryInset: number; clipAnimation: boolean } {
  return {
    boundaryInset: Number(getVal('boundaryInset').value),
    clipAnimation: (document.getElementById('clipAnimation') as HTMLInputElement).checked,
  };
}

function readFormIntoState(index: number): void {
  if (isUsingImportedZones()) {
    const regionIndex = getRegionIndexForVisibleZone(index);
    const zone = getActiveZoneConfigs()[index];
    if (!zone || regionIndex < 0) return;
    const updated = syncImportedZoneFromForm(zone, {
      sidesMin: Number(getVal('sidesMin').value),
      sidesMax: Math.max(Number(getVal('sidesMin').value), Number(getVal('sidesMax').value)),
      sizeMin: Number(getVal('sizeMin').value),
      sizeMax: Math.max(Number(getVal('sizeMin').value), Number(getVal('sizeMax').value)),
      pointCount: Number(getVal('pointCount').value),
      lineWidth: Number(getVal('lineWidth').value),
      lineColor: getVal('lineColor').value,
      lineOpacity: Number(getVal('lineOpacity').value),
      dotColor: getVal('dotColor').value,
      dotOpacity: Number(getVal('dotOpacity').value),
      speed: Number(getVal('speed').value),
      amplitude: Number(getVal('amplitude').value),
      cellFillMin: Number(getVal('cellFillMin').value),
      cellFillMax: Math.max(Number(getVal('cellFillMin').value), Number(getVal('cellFillMax').value)),
      ...readMeshFitFromForm(),
    }, hexToRgba);
    updateImportedZoneConfig(regionIndex, updated);
    return;
  }

  const state = zoneStates[index];
  state.layoutMode = getSelect('layoutMode').value as LayoutMode;
  state.posX = Number(getVal('posX').value);
  state.posY = Number(getVal('posY').value);
  state.widthPercent = Number(getVal('widthPercent').value);
  state.heightPercent = Number(getVal('heightPercent').value);
  state.sidesMin = Number(getVal('sidesMin').value);
  state.sidesMax = Math.max(state.sidesMin, Number(getVal('sidesMax').value));
  state.sizeMin = Number(getVal('sizeMin').value);
  state.sizeMax = Math.max(state.sizeMin, Number(getVal('sizeMax').value));
  state.pointCount = Number(getVal('pointCount').value);
  state.lineWidth = Number(getVal('lineWidth').value);
  state.lineColor = getVal('lineColor').value;
  state.lineOpacity = Number(getVal('lineOpacity').value);
  state.dotColor = getVal('dotColor').value;
  state.dotOpacity = Number(getVal('dotOpacity').value);
  state.speed = Number(getVal('speed').value);
  state.amplitude = Number(getVal('amplitude').value);
  state.cellFillMin = Number(getVal('cellFillMin').value);
  state.cellFillMax = Math.max(state.cellFillMin, Number(getVal('cellFillMax').value));
}

function updateZoneStatsPanel(index: number): void {
  const panel = document.getElementById('zoneStatsPanel')!;
  const region = isUsingImportedZones() ? getImportedRegionByVisibleIndex(index) : undefined;
  if (!region) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  const swatch = document.getElementById('zoneStatsSwatch') as HTMLElement;
  swatch.style.background = region.colorHex;
  document.getElementById('zoneStatsText')!.textContent =
    `${Math.round(region.area)} px² · ${region.points.length} vertices · ${region.colorHex}`;
}

function loadStateIntoForm(index: number): void {
  if (isUsingImportedZones()) {
    const zone = getActiveZoneConfigs()[index];
    if (!zone) return;
    getSelect('layoutMode').value = 'polygon';
    const style = zone.style ?? {};
    const anim = zone.animation ?? { speed: 0.3, amplitude: 8 };
    const sides = typeof zone.polygonSides === 'number'
      ? { min: zone.polygonSides, max: zone.polygonSides }
      : zone.polygonSides;

    getVal('sidesMin').value = String(sides.min);
    getVal('sidesMax').value = String(sides.max);
    getVal('sizeMin').value = String(zone.polygonSize.min);
    getVal('sizeMax').value = String(zone.polygonSize.max);
    getVal('pointCount').value = String(zone.pointCount ?? 0);
    getVal('lineWidth').value = String(style.lineWidth ?? 1);
    getVal('speed').value = String(Math.round((anim.speed ?? 0.3) * 100));
    getVal('amplitude').value = String(anim.amplitude ?? 8);
    const fit = zone.meshFit ?? { boundaryInset: 0, clipAnimation: true, autoSize: true };
    getVal('boundaryInset').value = String(fit.boundaryInset);
    (document.getElementById('clipAnimation') as HTMLInputElement).checked = fit.clipAnimation;

    const line = parseRgbaColor(style.lineColor ?? 'rgba(255,255,255,0.2)');
    const dot = parseRgbaColor(style.dotColor ?? 'rgba(255,255,255,0.5)');
    const cellFill = style.cellFill ?? { min: 0, max: 0 };
    getVal('lineColor').value = line.hex;
    getVal('lineOpacity').value = String(line.opacity);
    getVal('dotColor').value = dot.hex;
    getVal('dotOpacity').value = String(dot.opacity);
    getVal('cellFillMin').value = String(cellFill.min);
    getVal('cellFillMax').value = String(cellFill.max);

    document.getElementById('sidesMinVal')!.textContent = String(sides.min);
    document.getElementById('sidesMaxVal')!.textContent = String(sides.max);
    document.getElementById('sizeMinVal')!.textContent = String(zone.polygonSize.min);
    document.getElementById('sizeMaxVal')!.textContent = String(zone.polygonSize.max);
    document.getElementById('pointCountVal')!.textContent =
      zone.pointCount ? String(zone.pointCount) : 'auto';
    document.getElementById('lineWidthVal')!.textContent = String(style.lineWidth ?? 1);
    document.getElementById('lineOpacityVal')!.textContent = `${line.opacity}%`;
    document.getElementById('dotOpacityVal')!.textContent = `${dot.opacity}%`;
    document.getElementById('speedVal')!.textContent = (anim.speed ?? 0.3).toFixed(1);
    document.getElementById('amplitudeVal')!.textContent = String(anim.amplitude ?? 8);
    document.getElementById('boundaryInsetVal')!.textContent = String(fit.boundaryInset);
    document.getElementById('cellFillMinVal')!.textContent = `${cellFill.min}%`;
    document.getElementById('cellFillMaxVal')!.textContent = `${cellFill.max}%`;

    syncGlobalSlidersFromZone(
      Math.round((anim.speed ?? 0.3) * 100),
      anim.amplitude ?? 8,
      style.lineWidth ?? 1,
      line.opacity,
      dot.opacity,
      sides.min,
      sides.max,
      cellFill.min,
      cellFill.max,
    );
    updateLayoutFieldsVisibility();
    updateZoneStatsPanel(index);
    updateZoneControlsSummary();
    return;
  }

  const state = zoneStates[index];
  getSelect('layoutMode').value = state.layoutMode;
  getVal('posX').value = String(state.posX);
  getVal('posY').value = String(state.posY);
  getVal('widthPercent').value = String(state.widthPercent);
  getVal('heightPercent').value = String(state.heightPercent);
  getVal('sidesMin').value = String(state.sidesMin);
  getVal('sidesMax').value = String(state.sidesMax);
  getVal('sizeMin').value = String(state.sizeMin);
  getVal('sizeMax').value = String(state.sizeMax);
  getVal('pointCount').value = String(state.pointCount);
  getVal('lineWidth').value = String(state.lineWidth);
  getVal('lineColor').value = state.lineColor;
  getVal('lineOpacity').value = String(state.lineOpacity);
  getVal('dotColor').value = state.dotColor;
  getVal('dotOpacity').value = String(state.dotOpacity);
  getVal('speed').value = String(state.speed);
  getVal('amplitude').value = String(state.amplitude);
  getVal('cellFillMin').value = String(state.cellFillMin);
  getVal('cellFillMax').value = String(state.cellFillMax);

  document.getElementById('posXVal')!.textContent = String(state.posX);
  document.getElementById('posYVal')!.textContent = String(state.posY);
  document.getElementById('widthPercentVal')!.textContent = String(state.widthPercent);
  document.getElementById('heightPercentVal')!.textContent = String(state.heightPercent);
  document.getElementById('sidesMinVal')!.textContent = String(state.sidesMin);
  document.getElementById('sidesMaxVal')!.textContent = String(state.sidesMax);
  document.getElementById('sizeMinVal')!.textContent = String(state.sizeMin);
  document.getElementById('sizeMaxVal')!.textContent = String(state.sizeMax);
  document.getElementById('pointCountVal')!.textContent =
    state.pointCount > 0 ? String(state.pointCount) : 'auto';
  document.getElementById('lineWidthVal')!.textContent = String(state.lineWidth);
  document.getElementById('lineOpacityVal')!.textContent = `${state.lineOpacity}%`;
  document.getElementById('dotOpacityVal')!.textContent = `${state.dotOpacity}%`;
  document.getElementById('speedVal')!.textContent = (state.speed / 100).toFixed(1);
  document.getElementById('amplitudeVal')!.textContent = String(state.amplitude);
  document.getElementById('cellFillMinVal')!.textContent = `${state.cellFillMin}%`;
  document.getElementById('cellFillMaxVal')!.textContent = `${state.cellFillMax}%`;

  syncGlobalSlidersFromZone(
    state.speed,
    state.amplitude,
    state.lineWidth,
    state.lineOpacity,
    state.dotOpacity,
    state.sidesMin,
    state.sidesMax,
    state.cellFillMin,
    state.cellFillMax,
  );
  updateLayoutFieldsVisibility();
  updateZoneStatsPanel(index);
  updateZoneControlsSummary();
}

function updateControlsEmptyState(): void {
  const count = getZoneCount();
  const hiddenCount = isUsingImportedZones() ? getHiddenRegions().length : 0;
  const hasZones = count > 0;
  const hint = document.getElementById('noZonesHint')!;
  const controls = document.getElementById('zoneControls')!;
  const removeBtn = document.getElementById('removeZone') as HTMLButtonElement;
  const addBtn = document.getElementById('addZone') as HTMLButtonElement;

  if (!hasZones && hiddenCount > 0) {
    hint.textContent = 'All zones are hidden. Use "Show" below to restore a zone.';
    hint.hidden = false;
  } else {
    hint.textContent = 'No zones yet. Add one manually or import from an image.';
    hint.hidden = hasZones;
  }

  controls.classList.toggle('disabled', !hasZones);
  const details = document.getElementById('zoneControlsDetails') as HTMLDetailsElement;
  details.classList.toggle('disabled', !hasZones);
  removeBtn.disabled = !hasZones;
  addBtn.disabled = false;
}

function renderHiddenZonesPanel(): void {
  const panel = document.getElementById('hiddenZonesPanel')!;
  const list = document.getElementById('hiddenZonesList')!;
  const hidden = isUsingImportedZones() ? getHiddenRegions() : [];

  panel.hidden = hidden.length === 0;
  list.innerHTML = '';

  for (const { index, region } of hidden) {
    const item = document.createElement('div');
    item.className = 'hidden-zone-item';

    const swatch = document.createElement('span');
    swatch.className = 'zone-stats-swatch';
    swatch.style.background = region.colorHex;

    const label = document.createElement('span');
    label.className = 'hidden-zone-label';
    label.textContent = `Zone ${index + 1} · ${region.colorHex}`;

    const showBtn = document.createElement('button');
    showBtn.type = 'button';
    showBtn.className = 'btn-secondary btn-compact';
    showBtn.textContent = 'Show';
    showBtn.addEventListener('click', () => {
      setImportedRegionEnabled(index, true, () => {
        activeZoneIndex = getVisibleIndexForRegionIndex(index);
        renderZoneTabs();
        renderHiddenZonesPanel();
        loadStateIntoForm(activeZoneIndex);
        updateMesh();
      });
    });

    item.append(swatch, label, showBtn);
    list.appendChild(item);
  }
}

function renderZoneTabs(): void {
  const container = document.getElementById('zoneTabs')!;
  container.innerHTML = '';

  const count = getZoneCount();

  for (let index = 0; index < count; index++) {
    const color = isUsingImportedZones()
      ? getActiveZoneConfigs()[index]?.style?.lineColor ?? '#ffffff'
      : zoneStates[index].lineColor;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `zone-tab${index === activeZoneIndex ? ' active' : ''}`;
    btn.textContent = `Zone ${index + 1}`;
    btn.style.borderColor = colorToTabBorder(typeof color === 'string' ? color : '#ffffff');
    if (index === activeZoneIndex) {
      btn.style.background = 'rgba(255,255,255,0.12)';
    }
    btn.addEventListener('click', () => {
      if (index === activeZoneIndex) {
        flashActiveZoneHighlight();
        return;
      }
      readFormIntoState(activeZoneIndex);
      activeZoneIndex = index;
      loadStateIntoForm(activeZoneIndex);
      renderZoneTabs();
      const details = document.getElementById('zoneControlsDetails') as HTMLDetailsElement;
      details.open = true;
      flashActiveZoneHighlight();
      updateMesh();
    });
    container.appendChild(btn);
  }

  updateControlsEmptyState();
  renderHiddenZonesPanel();
  updateZoneControlsSummary();
}

function updatePreviewSettings(): void {
  const heroContent = document.querySelector('.hero-content') as HTMLElement;
  const hideForeground = (document.getElementById('hideForeground') as HTMLInputElement).checked;
  heroContent.classList.toggle('is-hidden', hideForeground);
  document.getElementById('hero')!.style.background = getVal('heroBgColor').value;
}

function onGlobalChange(): void {
  updateMesh();
}

function onGlobalStyleAllChange(): void {
  applyGlobalStyleToAllZones();
}

function onGeometryChange(): void {
  scheduleGeometryUpdate();
}

function onStyleChange(): void {
  applyStyleUpdate();
}

function bindRange(
  id: string,
  displayId: string,
  onChange: () => void,
  formatter?: (v: number) => string,
): void {
  const input = getVal(id);
  const display = document.getElementById(displayId)!;
  input.addEventListener('input', () => {
    const val = Number(input.value);
    display.textContent = formatter ? formatter(val) : String(val);
    onChange();
  });
}

const geometryFields = new Set([
  'posX', 'posY', 'widthPercent', 'heightPercent',
  'sidesMin', 'sidesMax', 'sizeMin', 'sizeMax', 'pointCount', 'boundaryInset',
  'cellFillMin', 'cellFillMax',
]);

function bindControl(id: string, displayId: string, formatter?: (v: number) => string): void {
  const handler = geometryFields.has(id) ? onGeometryChange : onStyleChange;
  bindRange(id, displayId, handler, formatter);
}

bindControl('posX', 'posXVal');
bindControl('posY', 'posYVal');
bindControl('widthPercent', 'widthPercentVal');
bindControl('heightPercent', 'heightPercentVal');
bindControl('sidesMin', 'sidesMinVal');
bindControl('sidesMax', 'sidesMaxVal');
bindControl('sizeMin', 'sizeMinVal');
bindControl('sizeMax', 'sizeMaxVal');
bindControl('pointCount', 'pointCountVal', (v) => (v > 0 ? String(v) : 'auto'));
bindControl('boundaryInset', 'boundaryInsetVal');
bindControl('lineWidth', 'lineWidthVal');
bindControl('lineOpacity', 'lineOpacityVal', (v) => `${v}%`);
bindControl('dotOpacity', 'dotOpacityVal', (v) => `${v}%`);
bindControl('cellFillMin', 'cellFillMinVal', (v) => `${v}%`);
bindControl('cellFillMax', 'cellFillMaxVal', (v) => `${v}%`);
bindControl('speed', 'speedVal', (v) => (v / 100).toFixed(1));
bindControl('amplitude', 'amplitudeVal');

bindRange('fps', 'fpsVal', onGlobalChange, (v) => (v === 0 ? 'static' : String(v)));
bindRange('maxPoints', 'maxPointsVal', onGlobalChange, (v) => (v > 0 ? String(v) : 'auto'));
bindRange('zoom', 'zoomVal', onGlobalChange, (v) => `${v}%`);
bindRange('panX', 'panXVal', onGlobalChange, (v) => `${v}%`);
bindRange('panY', 'panYVal', onGlobalChange, (v) => `${v}%`);
bindRange('globalSpeed', 'globalSpeedVal', onGlobalStyleAllChange, (v) => (v / 100).toFixed(1));
bindRange('globalAmplitude', 'globalAmplitudeVal', onGlobalStyleAllChange);
bindRange('globalLineWidth', 'globalLineWidthVal', onGlobalStyleAllChange);
bindRange('globalLineOpacity', 'globalLineOpacityVal', onGlobalStyleAllChange, (v) => `${v}%`);
bindRange('globalDotOpacity', 'globalDotOpacityVal', onGlobalStyleAllChange, (v) => `${v}%`);
bindRange('globalSidesMin', 'globalSidesMinVal', onGlobalStyleAllChange);
bindRange('globalSidesMax', 'globalSidesMaxVal', onGlobalStyleAllChange);
bindRange('globalCellFillMin', 'globalCellFillMinVal', onGlobalStyleAllChange, (v) => `${v}%`);
bindRange('globalCellFillMax', 'globalCellFillMaxVal', onGlobalStyleAllChange, (v) => `${v}%`);

(getSelect('layoutMode') as HTMLSelectElement).addEventListener('change', () => {
  updateLayoutFieldsVisibility();
  onGeometryChange();
});
getVal('lineColor').addEventListener('input', onStyleChange);
getVal('dotColor').addEventListener('input', onStyleChange);
(document.getElementById('clipAnimation') as HTMLInputElement).addEventListener('change', onGeometryChange);
(document.getElementById('hideForeground') as HTMLInputElement).addEventListener('change', updatePreviewSettings);
getVal('heroBgColor').addEventListener('input', updatePreviewSettings);
(document.getElementById('hideZoneBtn') as HTMLButtonElement).addEventListener('click', () => {
  if (!isUsingImportedZones() || getZoneCount() === 0) return;
  readFormIntoState(activeZoneIndex);
  const regionIndex = getRegionIndexForVisibleZone(activeZoneIndex);
  if (regionIndex < 0) return;
  setImportedRegionEnabled(regionIndex, false, () => {
    activeZoneIndex = Math.min(activeZoneIndex, Math.max(0, getZoneCount() - 1));
    renderZoneTabs();
    renderHiddenZonesPanel();
    if (getZoneCount() > 0) loadStateIntoForm(activeZoneIndex);
    updateMesh();
  });
});

document.getElementById('addZone')!.addEventListener('click', () => {
  if (getZoneCount() > 0) {
    readFormIntoState(activeZoneIndex);
  }
  if (isUsingImportedZones()) {
    resetMaskState();
  }
  zoneStates.push(createDefaultZoneState(zoneStates.length));
  activeZoneIndex = zoneStates.length - 1;
  loadStateIntoForm(activeZoneIndex);
  renderZoneTabs();
  updateMesh();
});

document.getElementById('removeZone')!.addEventListener('click', () => {
  if (getZoneCount() === 0) return;
  readFormIntoState(activeZoneIndex);

  if (isUsingImportedZones()) {
    removeImportedZoneAt(activeZoneIndex);
    refreshMaskUi();
    activeZoneIndex = Math.min(activeZoneIndex, Math.max(0, getZoneCount() - 1));
  } else {
    zoneStates.splice(activeZoneIndex, 1);
  }

  activeZoneIndex = getZoneCount() > 0 ? Math.min(activeZoneIndex, getZoneCount() - 1) : 0;
  if (getZoneCount() > 0) loadStateIntoForm(activeZoneIndex);
  renderZoneTabs();
  renderHiddenZonesPanel();
  updateMesh();
});

document.getElementById('resetAllZones')!.addEventListener('click', () => {
  zoneStates.length = 0;
  resetMaskState();
  activeZoneIndex = 0;
  renderZoneTabs();
  renderHiddenZonesPanel();
  updateMesh();
});

initMaskUi(() => {
  activeZoneIndex = 0;
  renderZoneTabs();
  renderHiddenZonesPanel();
  if (getZoneCount() > 0) loadStateIntoForm(0);
  updateMesh();
});

if (getZoneCount() > 0) {
  loadStateIntoForm(activeZoneIndex);
}
renderZoneTabs();
updatePreviewSettings();
updateMesh();
