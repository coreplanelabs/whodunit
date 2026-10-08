export interface ReportOptions {
    autoFix?: boolean;
    reportPath?: string;
    settingsUnavailable?: boolean;
    changesRecorded?: boolean;
    interactive?: boolean;
    context?: {
        title: string;
        summary: string;
    };
}
export declare function fixRequest(options: ReportOptions): string;
export declare function terminalFixQuestion(options?: ReportOptions): string;
