declare module 'd3-delaunay' {
  export class Delaunay {
    static from<T>(points: Iterable<T>, fx?: (d: T, i: number) => number, fy?: (d: T, i: number) => number): Delaunay;
    triangles: Int32Array;
  }
}
