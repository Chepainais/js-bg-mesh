# JS BG Mesh

Lightweight animated background mesh for websites — a network of dots connected by lines, generated with Delaunay triangulation. Place it behind page content, constrain it to rectangles or **custom polygon shapes** (e.g. logo parts).

**[Live demo](https://chepainais.github.io/js-bg-mesh/)** — interactive preview and mask-to-config export.

## Package

| | |
|---|---|
| **Name** | [`@chepainais/js-bg-mesh`](https://www.npmjs.com/package/@chepainais/js-bg-mesh) |
| **Version** | `1.0.2` |
| **License** | MIT |
| **Registry** | [npmjs.org](https://www.npmjs.com/package/@chepainais/js-bg-mesh) · [GitHub Packages](https://github.com/users/Chepainais/packages/npm/package/js-bg-mesh) |
| **Repository** | [github.com/Chepainais/js-bg-mesh](https://github.com/Chepainais/js-bg-mesh) |

**Install:**

```bash
npm install @chepainais/js-bg-mesh
```

**Import:**

```typescript
import { BgMesh } from '@chepainais/js-bg-mesh';
```

**Runtime dependency:** `d3-delaunay` (bundled as the only production dependency).

**Published files:** `dist/bg-mesh.es.js` (ESM), `dist/bg-mesh.umd.js` (UMD), `dist/index.d.ts` (TypeScript types), `LICENSE`, `README.md`. The demo and mask importer are **not** included in the npm package.

## Features

- **Wireframe mesh** — dots + lines (not filled triangles)
- **Multiple zones** per container, each with its own layout, style, and animation
- **Layout modes** — centered, percent, pixel, or **polygon** (from demo export or hand-written)
- **Logo / mask workflow** — demo tool exports ready-to-paste integration code (no runtime image parsing in production)
- **Smooth animation** — Perlin noise vertex drift
- **Small bundle** — Canvas 2D + `d3-delaunay` only (no Three.js)
- **ESM + UMD** — npm import or `<script>` tag

## Install

### npmjs.org (recommended)

```bash
npm install @chepainais/js-bg-mesh
```

No extra configuration — works like any public scoped package.

### GitHub Packages

Use this if you install packages from GitHub Packages instead of npmjs.org.

1. Create a [personal access token (classic)](https://github.com/settings/tokens) with `read:packages` scope
2. Add to your user `~/.npmrc` (do not commit tokens):

```
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

3. In your project, add `.npmrc`:

```
@chepainais:registry=https://npm.pkg.github.com
```

4. Install:

```bash
npm install @chepainais/js-bg-mesh
```

See [Working with the npm registry on GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

### From Git (development / no registry)

```bash
npm install github:Chepainais/js-bg-mesh
```

Or clone the repo and run the demo locally (see [Demo & mask import](#demo--mask-import)).

## Quick start (ESM)

```typescript
import { BgMesh } from '@chepainais/js-bg-mesh';

const mesh = BgMesh.init({
  container: document.getElementById('hero')!,
  zones: [{
    layout: { mode: 'centered', widthPercent: 30 },
    polygonSides: { min: 3, max: 5 },
    polygonSize: { min: 30, max: 80 },
    style: {
      lineColor: 'rgba(255, 255, 255, 0.15)',
      dotColor: 'rgba(255, 255, 255, 0.4)',
      dotRadius: 2,
    },
  }],
  animation: { speed: 0.3, amplitude: 8 },
});

// Later
mesh.update({ animation: { speed: 0.5 } });
mesh.destroy();
```

## Quick start (UMD / script tag)

```html
<div id="hero" style="position: relative; min-height: 100vh;">
  <div style="position: relative; z-index: 1;">
    <h1>Your content here</h1>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/@chepainais/js-bg-mesh@1.0.2/dist/bg-mesh.umd.js"></script>
<script>
  BgMesh.init({
    container: '#hero',
    zones: [{
      layout: { mode: 'centered', widthPercent: 30 },
      polygonSides: { min: 3, max: 5 },
      polygonSize: { min: 30, max: 80 },
      style: {
        lineColor: 'rgba(255, 255, 255, 0.15)',
        dotColor: 'rgba(255, 255, 255, 0.4)',
        dotRadius: 2,
      },
    }],
    animation: { speed: 0.3, amplitude: 8 },
  });
</script>
```

> Pin the version in the CDN URL (e.g. `@1.0.2`) when using in production. [unpkg](https://unpkg.com/@chepainais/js-bg-mesh@1.0.2/dist/bg-mesh.umd.js) works the same way.

## Demo & mask import

**[Live demo](https://chepainais.github.io/js-bg-mesh/)** — hosted on GitHub Pages. Updated automatically on every push to `main`.

The interactive demo includes a **mask importer** for turning a logo or diagram into polygon zones.

**Run locally:**

```bash
git clone https://github.com/Chepainais/js-bg-mesh.git
cd js-bg-mesh
npm install
npm run dev
```

Opens `http://localhost:5173`. In the sidebar, use **Zones from image**:

1. Upload a mask file:
   - **PNG** — flat colors per region on transparent or dark background; thin black lines between same-color parts
   - **SVG** — filled shapes (`path`, `polygon`, `rect`) with distinct `fill` colors
2. Preview detected regions and polygon outlines
3. Tune zones with the controls (per-zone tabs, global overrides, zoom/pan)
4. Click **Show code** or **Copy** — paste the exported config into your production page

**Production sites should use the exported static config** — do not ship the mask importer or parse images at runtime.

### Sample masks

Built-in sample buttons in the demo load files from `demo/samples/`:

| File | Description |
|------|-------------|
| [`logo-3zones.svg`](demo/samples/logo-3zones.svg) | Simple 3-zone SVG |
| [`sample-pentagons.svg`](demo/samples/sample-pentagons.svg) | 5 pentagon shapes |
| [`sample-mosaic.svg`](demo/samples/sample-mosaic.svg) | 4-piece mosaic |
| [`sample-bars.svg`](demo/samples/sample-bars.svg) | 5 vertical bars |

There is also a **Random mask** button that generates a synthetic test image in the browser.

### PNG mask tips

- Use **flat fill colors** per region (avoid gradients inside zones)
- Separate adjacent same-color regions with **1px black outlines**
- Prefer **transparent** or solid dark background
- Export at a reasonable size (e.g. 150–512 px); the demo preserves aspect ratio

## Configuration

### `BgMeshConfig`

| Property | Type | Description |
|----------|------|-------------|
| `container` | `string \| HTMLElement` | Target element (selector or DOM node) |
| `zones` | `ZoneConfig[]` | One or more mesh zones |
| `globalStyle` | `MeshStyle` | Default style for all zones |
| `animation` | `AnimationConfig` | Default animation for all zones |
| `fps` | `number` | Canvas redraw rate per second. `0` = static mesh. Default: `30` |
| `maxPointsPerZone` | `number` | Optional cap on auto-calculated points per zone |
| `viewTransform` | `ViewTransform` | Global zoom/pan applied to the whole mesh |

### `ZoneConfig`

| Property | Type | Description |
|----------|------|-------------|
| `layout` | `ZoneLayout` | Position and size of the zone |
| `polygonSides` | `number \| { min, max }` | Target polygon vertex count |
| `polygonSize` | `{ min, max }` | Approximate cell size in pixels |
| `pointCount` | `number` | Optional fixed point count override |
| `maxPointCount` | `number` | Optional per-zone cap (overrides global when lower) |
| `style` | `MeshStyle` | Zone-specific style overrides |
| `animation` | `AnimationConfig` | Zone-specific animation overrides |
| `meshFit` | `MeshFitConfig` | Polygon zone boundary behaviour |

### Layout modes

**Centered** — middle portion of the container:

```javascript
{ mode: 'centered', widthPercent: 30, heightPercent: 100 }
```

**Percent** — explicit percentage rectangle:

```javascript
{ mode: 'percent', x: 10, y: 0, width: 80, height: 100 }
```

**Pixel** — absolute pixel rectangle:

```javascript
{ mode: 'pixel', x: 100, y: 50, width: 600, height: 400 }
```

**Polygon** — custom shape (from demo export or hand-written):

```javascript
{
  mode: 'polygon',
  unit: 'percent',  // or 'pixel'
  points: [
    { x: 42.1, y: 18.5 },
    { x: 55.3, y: 22.0 },
    { x: 48.0, y: 35.2 },
  ],
}
```

Percent coordinates scale with the container on resize. The mesh is generated only inside the polygon boundary.

**Mesh fit** (polygon zones):

```javascript
meshFit: {
  boundaryInset: 6,    // px inside polygon edge
  clipAnimation: true, // keep animation inside polygon
  autoSize: true,      // derive cell size from polygon area
}
```

| Property | Default (polygon) | Description |
|----------|-------------------|-------------|
| `boundaryInset` | `6` | Min distance from polygon edge for mesh points (px) |
| `clipAnimation` | `true` | Limit animation so vertices don't drift outside |
| `autoSize` | `true` | Auto-calculate `polygonSize` from polygon area |

Imported zones from the demo default to `boundaryInset: 0`.

### Multiple zones

```javascript
BgMesh.init({
  container: '#hero',
  zones: [
    {
      layout: { mode: 'centered', widthPercent: 30 },
      polygonSides: { min: 3, max: 5 },
      polygonSize: { min: 30, max: 80 },
      style: { lineColor: 'rgba(255,255,255,0.15)' },
    },
    {
      layout: { mode: 'percent', x: 5, y: 10, width: 20, height: 80 },
      polygonSides: 3,
      polygonSize: { min: 20, max: 50 },
      style: { lineColor: 'rgba(100,180,255,0.2)' },
    },
  ],
});
```

### Style options

| Property | Default | Description |
|----------|---------|-------------|
| `lineColor` | `rgba(255,255,255,0.2)` | Edge stroke color |
| `dotColor` | `rgba(255,255,255,0.5)` | Vertex dot color |
| `lineWidth` | `1` | Edge stroke width |
| `dotRadius` | `2` | Vertex dot radius |
| `fillColor` | `transparent` | Polygon fill color |
| `cellFill` | — | Per-cell fill opacity range (`{ min, max }`, 0–100). Uses line color RGB; random per cell when `min < max` |

### View transform

Optional global zoom/pan (CSS transform on the canvas):

```javascript
viewTransform: {
  scale: 1.2,
  translateX: 0,
  translateY: 0,
  originX: 400,  // default: container center
  originY: 300,
}
```

### Performance options

| Property | Default | Description |
|----------|---------|-------------|
| `fps` | `30` | Redraw rate. Use `15` for lighter load, `60` for smoother motion, `0` to freeze |
| `maxPointsPerZone` | none | Limits auto-generated point count |
| `pointCount` | auto | Exact number of points in a zone |
| `maxPointCount` | none | Per-zone point cap |

### Animation options

| Property | Default | Description |
|----------|---------|-------------|
| `speed` | `0.3` | Animation speed multiplier |
| `amplitude` | `8` | Max vertex drift in pixels |

## CSS recommendations

The container should have `position: relative` (set automatically if `static`). Place content above the mesh with `position: relative; z-index: 1`. The canvas uses `pointer-events: none` so it does not block interactions.

```css
.hero {
  position: relative;
  min-height: 100vh;
}

.hero-content {
  position: relative;
  z-index: 1;
}
```

## API

| Method | Description |
|--------|-------------|
| `BgMesh.init(config)` | Create and start a mesh instance |
| `instance.update(config)` | Regenerate mesh with new settings |
| `instance.destroy()` | Stop animation and remove canvas |

Exported types: `BgMeshConfig`, `ZoneConfig`, `ZoneLayout`, `MeshStyle`, `AnimationConfig`, `ViewTransform`.

## How this compares to similar projects

| | js-bg-mesh | [Vanta.js NET](https://github.com/tengbao/vanta) | [polygon-background](https://github.com/K4ugummi/polygon-background) |
|---|:---:|:---:|:---:|
| Wireframe dots + lines | yes | yes | partial |
| Delaunay triangulation | yes | no | yes |
| Multiple zones | yes | no | no |
| Polygon zones from logo mask | yes | no | no |
| No Three.js / WebGL | yes | no | no |
| Mouse physics | no | yes | yes |

**js-bg-mesh** fits when you need a **lightweight mesh inside specific shapes** (e.g. logo parts). For fullscreen decorative backgrounds with mouse interaction, consider Vanta or polygon-background instead.

## Development

```bash
npm install
npm run dev          # demo at http://localhost:5173
npm run build        # library → dist/
npm run build:demo   # static demo → demo-dist/ (same as GitHub Pages deploy)
npm run preview:demo # preview demo-dist/ locally
```

`npm run dev` serves the `demo/` folder. `npm run build` compiles the library from `src/` into `dist/`. The live demo is built with `npm run build:demo` and deployed via GitHub Actions.

### Project layout

```
src/                      Library source (published to npm as dist/)
  BgMesh.ts               Public API entry
  index.ts                Package exports
  types.ts                Config and mesh types
  animation/              Vertex animation (Perlin noise)
  geometry/               Polygon helpers
  mesh/                   Point generation, Delaunay, edge filtering
  render/                 Canvas renderer and view transform
  zone/                   Layout resolution (rect / polygon)

demo/                     Interactive demo (not published to npm)
  index.html              Demo page
  demo.ts                 Controls and live preview
  demo.css
  maskUi.ts               Mask import UI wiring
  maskIntegration.ts      Applies imported zones to the demo mesh
  zoneHighlight.ts        Zone hover / flash overlay
  randomSample.ts         Procedural test mask generator
  maskImporter/           PNG/SVG → zone config (demo only)
    detectRegions.ts
    parseSvg.ts
    exportConfig.ts       Integration code export
    ...
  samples/                Example mask SVG files

dist/                     Build output (ESM, UMD, TypeScript declarations)
vite.config.ts            Dev → demo root; build → library mode
```

## License

MIT — see [LICENSE](LICENSE).
