export interface LocalOptions {
    repository: string;
    symptom?: string;
    errorLog?: string;
    errorLogLocator?: string;
}
export interface LocalIo {
    git(repository: string, args: string[], timeoutMs: number): string;
    readNewFile(repository: string, path: string): string;
    now(): string;
    elapsed(): number;
}
export declare function safeLocalPath(path: string): boolean;
export interface LocalHistoryOptions {
    repository: string;
    path: string;
    search?: string;
}
export declare function localGitEnvironment(input: Record<string, string | undefined>): {
    [k: string]: string | undefined;
};
export declare function collectLocal(options: LocalOptions, io?: LocalIo): {
    schemaVersion: string;
    capturedAt: string;
    repository: {
        root: string;
        head: string;
        comparison: "latest_commit" | "working_tree";
        base: string;
    };
    symptom: {
        text: string | null;
        assurance: string;
    };
    errorLog: {
        text: string;
        truncated: boolean;
        locator: string;
        assurance: string;
    } | null;
    changedFiles: {
        path: string;
        locator: string;
        selection: string;
        state: string;
    }[];
    diff: {
        text: string;
        truncated: boolean;
    };
    newFiles: {
        text: string;
        truncated: boolean;
        path: string;
    }[];
    sessions: {
        access: string;
        ownership: string;
        instruction: string;
    };
    gaps: string[];
    cautions: string[];
    handoff: string;
};
export declare function validateErrorFile(path: string): void;
export declare function collectLocalHistory(options: LocalHistoryOptions, io?: LocalIo): {
    schemaVersion: string;
    capturedAt: string;
    repository: {
        root: string;
        head: string;
    };
    scope: {
        path: string;
        search: string | null;
        firstParentOnly: boolean;
        followRenames: boolean;
        maxChanges: number;
    };
    changes: {
        head: string;
        parent: string | null;
        subject: string;
        diff: {
            text: string;
            truncated: boolean;
        };
    }[];
    gaps: string[];
    cautions: string[];
};
