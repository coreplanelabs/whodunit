import { type DebugGraph } from "./graph.js";
type Assurance = "observed" | "reported" | "hypothesis" | "unknown";
export interface DebugCard {
    schemaVersion: "debug-card/1";
    title: string;
    scope: string;
    context?: string;
    nextCheck?: string;
    graph?: DebugGraph;
    rca?: {
        summary: string;
        assurance: Assurance;
        sourceIds: string[];
        checks: {
            explanation: string;
            evidence: string;
            outcome: "supports" | "contradicts" | "unresolved";
            sourceIds: string[];
        }[];
        history?: {
            summary: string;
            sourceIds: string[];
        };
        gaps?: string[];
    };
    findings: {
        id: string;
        title: string;
        assurance: Assurance;
        steps: string[];
        detail: string;
        sourceIds: string[];
    }[];
    sources: {
        id: string;
        origin: "direct_read" | "provided_answer" | "session_statement" | "user_input";
        label: string;
        locator: string;
        excerpt: string;
    }[];
}
export declare function parseDebugCard(value: unknown): DebugCard;
export declare function renderDebugCard(input: unknown): string;
export declare function renderDebugText(input: unknown): string;
export declare function renderDebugDocument(input: unknown): string;
export declare function renderTerminalSummary(input: unknown, reportPath: string): string;
export {};
