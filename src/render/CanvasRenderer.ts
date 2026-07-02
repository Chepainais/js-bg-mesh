import type { ZoneMesh, ViewTransform } from '../types';
import { applyViewTransformToElement } from './viewTransform';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    const ctx = this.canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;

    const position = getComputedStyle(container).position;
    if (position === 'static') {
      container.style.position = 'relative';
    }
    container.prepend(this.canvas);
  }

  resize(width: number, height: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear(width: number, height: number): void {
    this.ctx.clearRect(0, 0, width, height);
  }

  render(
    zones: ZoneMesh[],
    width: number,
    height: number,
    viewTransform?: ViewTransform,
  ): void {
    this.clear(width, height);
    applyViewTransformToElement(this.canvas, viewTransform, width, height);

    for (const zone of zones) {
      const { vertices, edges, polygons, fillPolygons, style } = zone;
      const shapesToFill = (fillPolygons && fillPolygons.length > 0) ? fillPolygons : polygons;
      const hasCellFill = shapesToFill.some((p) => p.fillColor);
      const hasStyleFill = style.fillColor !== 'transparent';

      if (hasStyleFill || hasCellFill) {
        for (const poly of shapesToFill) {
          const fill = poly.fillColor ?? style.fillColor;
          if (!fill || fill === 'transparent') continue;
          if (poly.vertices.length < 3) continue;
          this.ctx.fillStyle = fill;
          this.ctx.beginPath();
          const first = vertices[poly.vertices[0]];
          this.ctx.moveTo(first.x, first.y);
          for (let i = 1; i < poly.vertices.length; i++) {
            const v = vertices[poly.vertices[i]];
            this.ctx.lineTo(v.x, v.y);
          }
          this.ctx.closePath();
          this.ctx.fill();
        }
      }

      if (edges.length > 0) {
        this.ctx.strokeStyle = style.lineColor;
        this.ctx.lineWidth = style.lineWidth;
        this.ctx.beginPath();
        for (const edge of edges) {
          const a = vertices[edge.a];
          const b = vertices[edge.b];
          this.ctx.moveTo(a.x, a.y);
          this.ctx.lineTo(b.x, b.y);
        }
        this.ctx.stroke();
      }

      if (vertices.length > 0 && style.dotRadius > 0) {
        const usedVertices = new Set<number>();
        for (const edge of edges) {
          usedVertices.add(edge.a);
          usedVertices.add(edge.b);
        }
        this.ctx.fillStyle = style.dotColor;
        const r = style.dotRadius;
        const d = r * 2;
        for (const index of usedVertices) {
          const v = vertices[index];
          if (!v) continue;
          this.ctx.fillRect(v.x - r, v.y - r, d, d);
        }
      }
    }
  }

  destroy(): void {
    this.canvas.remove();
  }
}
