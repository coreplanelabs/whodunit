export interface Preferences {
    schemaVersion: "whodunit-settings/1";
    autoFix: boolean;
}
export interface PreferencesSnapshot extends Preferences {
    path: string;
}
export declare function readPreferences(home?: string): PreferencesSnapshot;
export declare function writePreferences(autoFix: boolean, home?: string): PreferencesSnapshot;
