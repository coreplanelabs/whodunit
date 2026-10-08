export interface DebugGraph {
    title: string;
    focusId?: string;
    nodes: {
        id: string;
        label: string;
        detail: string;
        column: number;
        sourceIds: string[];
        assurance: "observed" | "reported" | "hypothesis" | "unknown";
    }[];
    edges: {
        from: string;
        to: string;
        kind: "causes" | "supports" | "contradicts";
    }[];
}
export interface GraphGeometry {
    width: number;
    vertical: boolean;
    nodes: Record<string, {
        left: number;
        right: number;
        top: number;
        bottom: number;
    }>;
    edges: DebugGraph["edges"];
}
export declare function routeGraphEdge(edge: DebugGraph["edges"][number], geometry: GraphGeometry): string;
export declare function renderGraph(graph: DebugGraph, root: string, sources: (ids: string[]) => string): string;
