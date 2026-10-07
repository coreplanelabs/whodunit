export interface ReportOptions {
    autoFix?: boolean;
    reportPath?: string;
    delivery?: "inline" | "browser" | "demo";
    settingsUnavailable?: boolean;
    changesRecorded?: boolean;
    interactive?: boolean;
    context?: {
        title: string;
        summary: string;
    };
}
export declare function fixRequest(options: ReportOptions): string;
export declare function preferenceRequest(enabled: boolean): string;
export declare function terminalFixQuestion(options?: ReportOptions): string;
export declare function alwaysFixRequest(options: ReportOptions): string;
export declare function nativeFollowups(options: ReportOptions): string;
