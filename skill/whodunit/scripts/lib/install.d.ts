export type InstallAgent = "all" | "codex" | "claude" | "opencode";
export interface InstallReceipt {
    owner: string;
    version: string;
    files: Record<string, string>;
}
export declare function targetPaths(agent: InstallAgent): string[];
export declare function validateOwned(receipt: unknown, actual: Record<string, string>): void;
export declare function installSkill(project: string, source: string, version: string, agent?: InstallAgent): {
    changed: boolean;
    targets: string[];
    backups?: never;
} | {
    changed: boolean;
    targets: string[];
    backups: string[];
};
