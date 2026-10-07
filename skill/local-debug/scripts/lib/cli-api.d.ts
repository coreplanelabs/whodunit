import { type LocalIo } from "./local.js";
export interface CliIo {
    read(path: string): string;
    out(text: string): void;
    error(text: string): void;
}
export interface FileIo {
    open(path: string): number;
    stat(fd: number): {
        isFile(): boolean;
        size: number;
    };
    read(fd: number, buffer: Buffer, offset: number, length: number): number;
    close(fd: number): void;
}
export declare function readBounded(path: string, io?: FileIo): string;
export declare function dispatchCli(args: string[], io: CliIo, _env?: unknown, _dependencies?: unknown, localIo?: LocalIo): Promise<number>;
