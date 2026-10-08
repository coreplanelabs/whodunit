import { expect, test } from "bun:test";
import { type GraphGeometry, routeGraphEdge } from "../src/graph.js";

const coordinates = (path: string) => {
  const values = path.match(/-?\d+(?:\.\d+)?/gu)!.map(Number);
  return Array.from({ length: values.length / 2 }, (_, i) => [
    values[2 * i]!,
    values[2 * i + 1]!,
  ]);
};

test("mobile inputs join the next stage at distinct top ports within the gap", () => {
  const geometry: GraphGeometry = {
    width: 320,
    vertical: true,
    nodes: {
      left: { left: 16, right: 153, top: 12, bottom: 76 },
      right: { left: 167, right: 304, top: 12, bottom: 76 },
      target: { left: 16, right: 304, top: 108, bottom: 172 },
    },
    edges: [
      { from: "left", to: "target", kind: "supports" },
      { from: "right", to: "target", kind: "supports" },
    ],
  };
  const routes = geometry.edges.map((e) =>
    coordinates(routeGraphEdge(e, geometry)),
  );
  const ends = routes.map((points) => points.at(-1)!);
  expect(ends[0]![0]).not.toBe(ends[1]![0]);
  for (const points of routes) {
    expect(points[0]![1]).toBe(76);
    expect(points.at(-1)![1]).toBe(108);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(16);
      expect(x).toBeLessThanOrEqual(304);
      expect(y).toBeGreaterThanOrEqual(76);
      expect(y).toBeLessThanOrEqual(108);
    }
  }
});

test("a mobile connection skips intervening nodes without leaving the graph", () => {
  const geometry: GraphGeometry = {
    width: 320,
    vertical: true,
    nodes: {
      start: { left: 16, right: 304, top: 12, bottom: 76 },
      middle: { left: 16, right: 304, top: 108, bottom: 172 },
      end: { left: 16, right: 304, top: 204, bottom: 268 },
    },
    edges: [{ from: "start", to: "end", kind: "causes" }],
  };
  const points = coordinates(routeGraphEdge(geometry.edges[0]!, geometry));
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]!,
      [x2, y2] = points[i]!;
    for (let step = 0; step <= 20; step++) {
      const x = x1! + ((x2! - x1!) * step) / 20,
        y = y1! + ((y2! - y1!) * step) / 20;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(320);
      expect(x > 16 && x < 304 && y > 108 && y < 172).toBe(false);
    }
  }
});

test("desktop arrows retain left-to-right node ports", () => {
  const geometry: GraphGeometry = {
    width: 700,
    vertical: false,
    nodes: {
      start: { left: 16, right: 200, top: 12, bottom: 94 },
      end: { left: 234, right: 418, top: 12, bottom: 94 },
    },
    edges: [{ from: "start", to: "end", kind: "causes" }],
  };
  const points = coordinates(routeGraphEdge(geometry.edges[0]!, geometry));
  expect(points[0]).toEqual([200, 53]);
  expect(points.at(-1)).toEqual([234, 53]);
});

test("long desktop links pass around nodes in either direction", () => {
  const geometry: GraphGeometry = {
    width: 680,
    vertical: false,
    nodes: {
      start: { left: 16, right: 200, top: 18, bottom: 100 },
      middle: { left: 234, right: 418, top: 18, bottom: 100 },
      end: { left: 452, right: 636, top: 18, bottom: 100 },
    },
    edges: [
      { from: "start", to: "end", kind: "supports" },
      { from: "end", to: "start", kind: "contradicts" },
    ],
  };
  for (const edge of geometry.edges) {
    const points = coordinates(routeGraphEdge(edge, geometry));
    const collisions: string[] = [];
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1]!,
        [x2, y2] = points[i]!;
      for (let step = 0; step <= 20; step++) {
        const x = x1! + ((x2! - x1!) * step) / 20,
          y = y1! + ((y2! - y1!) * step) / 20;
        for (const [id, r] of Object.entries(geometry.nodes)) {
          if (x > r.left && x < r.right && y > r.top && y < r.bottom)
            collisions.push(id);
        }
      }
    }
    expect(collisions).toEqual([]);
  }
});
