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
export declare function renderGraph(graph: DebugGraph, root: string, sources: (ids: string[]) => string): string;
