import type { BgMeshConfig, ResolvedZoneConfig, ZoneConfig, ZoneMesh } from './types';
import { DEFAULT_FPS } from './types';
import { resolveZone } from './zone/ZoneLayout';
import { buildZoneMesh } from './mesh/Mesh';
import { animateVertices } from './animation/Animator';
import { CanvasRenderer } from './render/CanvasRenderer';

export interface BgMeshInstance {
  update(config: Partial<BgMeshConfig> & { zones?: BgMeshConfig['zones'] }): void;
  destroy(): void;
}

function zoneGeometryKey(zone: ZoneConfig, width: number, height: number): string {
  const sides = typeof zone.polygonSides === 'number'
    ? `${zone.polygonSides}`
    : `${zone.polygonSides.min}-${zone.polygonSides.max}`;
  const size = `${zone.polygonSize.min}-${zone.polygonSize.max}`;
  const points = zone.pointCount ?? '';
  const maxPoints = zone.maxPointCount ?? '';
  const meshFit = zone.meshFit ? JSON.stringify(zone.meshFit) : '';
  const cellFill = zone.style?.cellFill ? JSON.stringify(zone.style.cellFill) : '';
  return `${width}x${height}|${JSON.stringify(zone.layout)}|${sides}|${size}|${points}|${maxPoints}|${meshFit}|${cellFill}`;
}

class BgMeshImpl implements BgMeshInstance {
  private container: HTMLElement;
  private config: BgMeshConfig;
  private renderer: CanvasRenderer;
  private zoneMeshes: ZoneMesh[] = [];
  private resolvedZones: ResolvedZoneConfig[] = [];
  private geometryKeys: string[] = [];
  private resizeObserver: ResizeObserver;
  private resizeTimer = 0;
  private rafId = 0;
  private startTime = performance.now();
  private destroyed = false;
  private visible = true;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private lastFrame = 0;
  private needsRender = true;

  constructor(config: BgMeshConfig) {
    this.config = config;
    this.container = resolveContainer(config.container);
    this.renderer = new CanvasRenderer(this.container);
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.resizeObserver.observe(this.container);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.rebuild(true);
    this.startAnimation();
  }

  update(config: Partial<BgMeshConfig> & { zones?: BgMeshConfig['zones'] }): void {
    this.config = {
      ...this.config,
      ...config,
      zones: config.zones ?? this.config.zones,
    };
    this.needsRender = true;
    this.rebuild(false);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.resizeTimer);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.renderer.destroy();
  }

  private onVisibilityChange = (): void => {
    this.visible = document.visibilityState === 'visible';
    if (this.visible) {
      this.lastFrame = 0;
      this.startTime = performance.now();
      this.needsRender = true;
    }
  };

  private scheduleResize(): void {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.rebuild(true), 150);
  }

  private getFps(): number {
    return this.config.fps ?? DEFAULT_FPS;
  }

  private getFrameInterval(): number {
    const fps = this.getFps();
    if (fps <= 0) return Infinity;
    return 1000 / Math.min(fps, 120);
  }

  private renderFrame(elapsed: number, animate: boolean): void {
    if (this.zoneMeshes.length === 0 || this.canvasWidth <= 0 || this.canvasHeight <= 0) return;

    if (animate) {
      for (let i = 0; i < this.zoneMeshes.length; i++) {
        const mesh = this.zoneMeshes[i];
        const anim = this.resolvedZones[i]?.animation ?? mesh.animation;
        const fit = mesh.meshFit ?? this.resolvedZones[i]?.meshFit;
        animateVertices(
          mesh.vertices,
          elapsed,
          anim.speed,
          anim.amplitude,
          mesh.clipPolygon,
          fit?.boundaryInset ?? 0,
          fit?.clipAnimation ?? false,
        );
      }
    }

    this.renderer.render(
      this.zoneMeshes,
      this.canvasWidth,
      this.canvasHeight,
      this.config.viewTransform,
    );
    this.needsRender = false;
  }

  private rebuild(forceGeometry: boolean): void {
    const { width, height } = this.container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    const sizeChanged = width !== this.canvasWidth || height !== this.canvasHeight;
    if (sizeChanged) {
      this.canvasWidth = width;
      this.canvasHeight = height;
      this.renderer.resize(width, height);
    }

    const globalMax = this.config.maxPointsPerZone;
    const newResolved = this.config.zones.map((zone) =>
      resolveZone(zone, width, height, this.config.globalStyle, this.config.animation, globalMax),
    );

    const newKeys = this.config.zones.map((zone) => zoneGeometryKey(zone, width, height));
    const zoneCountChanged = newKeys.length !== this.geometryKeys.length;
    const globalMaxKey = globalMax ?? '';

    if (forceGeometry || sizeChanged || zoneCountChanged) {
      this.resolvedZones = newResolved;
      this.geometryKeys = newKeys;
      this.zoneMeshes = newResolved.map((zone) => buildZoneMesh(zone));
      this.needsRender = true;
      if (this.getFps() <= 0) {
        this.renderFrame(0, false);
      }
      return;
    }

    const nextMeshes: ZoneMesh[] = [];
    let geometryChanged = false;

    for (let i = 0; i < newResolved.length; i++) {
      const keyWithGlobal = `${newKeys[i]}|${globalMaxKey}`;
      const oldKeyWithGlobal = `${this.geometryKeys[i]}|${globalMaxKey}`;

      if (keyWithGlobal !== oldKeyWithGlobal) {
        nextMeshes.push(buildZoneMesh(newResolved[i]));
        geometryChanged = true;
      } else {
        const existing = this.zoneMeshes[i];
        nextMeshes.push({
          ...existing,
          style: newResolved[i].style,
          animation: newResolved[i].animation,
        });
      }
    }

    this.resolvedZones = newResolved;
    this.geometryKeys = newKeys;
    this.zoneMeshes = nextMeshes;

    if (geometryChanged) {
      this.needsRender = true;
      if (this.getFps() <= 0) {
        this.renderFrame(0, false);
      }
    }
  }

  private startAnimation(): void {
    const tick = (now: number) => {
      if (this.destroyed) return;

      if (this.visible && this.zoneMeshes.length > 0) {
        const frameInterval = this.getFrameInterval();
        const elapsed = now - this.startTime;

        if (frameInterval === Infinity) {
          if (this.needsRender) {
            this.renderFrame(elapsed, false);
          }
        } else if (this.needsRender || now - this.lastFrame >= frameInterval) {
          this.lastFrame = now;
          this.renderFrame(elapsed, true);
        }
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }
}

function resolveContainer(container: string | HTMLElement): HTMLElement {
  if (typeof container === 'string') {
    const el = document.querySelector(container);
    if (!el || !(el instanceof HTMLElement)) {
      throw new Error(`Container not found: ${container}`);
    }
    return el;
  }
  return container;
}

export const BgMesh = {
  init(config: BgMeshConfig): BgMeshInstance {
    return new BgMeshImpl(config);
  },
};

export type { BgMeshConfig, ZoneConfig, ZoneLayout, MeshStyle, AnimationConfig, ViewTransform } from './types';
