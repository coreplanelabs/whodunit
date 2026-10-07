import { expect, test } from "bun:test";
import { Script } from "node:vm";
import { renderGraph } from "../src/graph.js";

const graph = {
  title: "Why the reader receives no value",
  nodes: [
    {
      id: "export",
      label: "Setting renamed",
      detail: "Export changed",
      column: 0,
      sourceIds: [],
      assurance: "unknown" as const,
    },
    {
      id: "reader",
      label: "Reader uses old name",
      detail: "Reader unchanged",
      column: 1,
      sourceIds: [],
      assurance: "unknown" as const,
    },
  ],
  edges: [{ from: "export", to: "reader", kind: "causes" as const }],
};

function runtime() {
  const activity: string[] = [];
  const frames: (() => void)[] = [];
  const observers: (() => void)[] = [];
  const rect = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  });
  const box = rect(0, 0, 600, 180);
  const element = () => ({
    attributes: new Map<string, string>(),
    dataset: {} as Record<string, string>,
    setAttribute(name: string, value: string) {
      activity.push("write");
      this.attributes.set(name, value);
    },
  });
  const nodes = graph.nodes.map((n, i) => ({
    ...element(),
    dataset: { node: n.id },
    bounds: rect(i * 300, 30, 220, 76),
    listeners: new Map<string, () => void>(),
    getBoundingClientRect() {
      activity.push("read");
      return this.bounds;
    },
    addEventListener(name: string, listener: () => void) {
      this.listeners.set(name, listener);
    },
  }));
  const panels = graph.nodes.map((n, i) => ({
    dataset: { panel: n.id },
    hidden: i !== 0,
  }));
  const paths = {
    children: [] as ReturnType<typeof element>[],
    replaceChildren() {
      activity.push("write");
      this.children.length = 0;
    },
    append(path: ReturnType<typeof element>) {
      activity.push("write");
      this.children.push(path);
    },
  };
  const svg = { ...element(), querySelector: () => paths };
  const map = {
    getBoundingClientRect() {
      activity.push("read");
      return box;
    },
    querySelector: () => svg,
  };
  const root = {
    isConnected: true,
    querySelector: () => map,
    querySelectorAll: (selector: string) =>
      selector === "[data-node]" ? nodes : panels,
  };
  const script = renderGraph(graph, "report", () => "").match(
    /<script>([\s\S]*?)<\/script>/u,
  )![1]!;
  new Script(script).runInNewContext({
    document: { getElementById: () => root, createElementNS: () => element() },
    requestAnimationFrame: (callback: () => void) => {
      frames.push(callback);
      return frames.length;
    },
    ResizeObserver: class {
      constructor(callback: () => void) {
        observers.push(callback);
      }
      observe() {}
    },
  });
  return {
    activity,
    frames,
    observers,
    box,
    nodes,
    panels,
    paths,
    svg,
    root,
    flush: () => frames.shift()!(),
  };
}

test("graph defers resize writes, coalesces notifications and leaves stable geometry untouched", () => {
  const r = runtime();
  expect(r.activity).toEqual([]);
  r.observers[0]!();
  r.observers[0]!();
  expect(r.frames).toHaveLength(1);
  r.flush();
  expect(r.paths.children).toHaveLength(1);
  const firstWrite = r.activity.indexOf("write");
  expect(firstWrite).toBeGreaterThan(0);
  expect(r.activity.slice(firstWrite)).not.toContain("read");
  const path = r.paths.children[0]!;
  const initialPath = path.attributes.get("d");
  r.activity.length = 0;
  r.observers[0]!();
  r.flush();
  expect(r.activity).not.toContain("write");

  r.box.width = 320;
  r.nodes[1]!.bounds = {
    left: 0,
    top: 120,
    width: 220,
    height: 76,
    right: 220,
    bottom: 196,
  };
  r.observers[0]!();
  r.flush();
  expect(r.svg.attributes.get("viewBox")).toBe("0 0 320 180");
  expect(r.paths.children[0]).toBe(path);
  expect(path.attributes.get("d")).not.toBe(initialPath);

  r.nodes[1]!.listeners.get("click")!();
  expect(r.nodes[1]!.attributes.get("aria-pressed")).toBe("true");
  expect(r.panels.map((p) => p.hidden)).toEqual([true, false]);
  r.activity.length = 0;
  r.root.isConnected = false;
  r.observers[0]!();
  r.flush();
  expect(r.activity).toEqual([]);
});
