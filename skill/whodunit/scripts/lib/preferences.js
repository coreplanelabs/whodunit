import { randomUUID } from "node:crypto";
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, renameSync, unlinkSync, writeFileSync, } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { InputError } from "./errors.js";
const defaults = {
    schemaVersion: "whodunit-settings/1",
    autoFix: false,
};
function location(home = homedir()) {
    const root = realpathSync(resolve(home));
    return {
        root,
        path: join(root, ".coreplanelabs", "whodunit", "settings.json"),
    };
}
function safeParents(root, target) {
    let current = root;
    for (const part of relative(root, target).split(/[\\/]/u)) {
        current = join(current, part);
        try {
            const stat = lstatSync(current);
            if (stat.isSymbolicLink() || !stat.isDirectory())
                throw new InputError("The settings folder must be a regular folder.");
        }
        catch (error) {
            if (!(error &&
                typeof error === "object" &&
                "code" in error &&
                error.code === "ENOENT"))
                throw error;
        }
    }
}
export function readPreferences(home) {
    const { root, path } = location(home);
    safeParents(root, dirname(path));
    try {
        if (!lstatSync(path).isFile())
            throw new InputError("The settings file must be a regular file.");
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT")
            return { ...defaults, path };
        throw error;
    }
    let fd;
    try {
        fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0));
        const stat = fstatSync(fd);
        if (!stat.isFile() || stat.size > 4096)
            throw Error("Invalid file");
        const bytes = Buffer.alloc(4097);
        let length = 0;
        while (length < bytes.length) {
            const count = readSync(fd, bytes, length, bytes.length - length, null);
            if (count === 0)
                break;
            length += count;
        }
        if (length > 4096)
            throw Error("Invalid file");
        const input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)));
        if (!input ||
            input.schemaVersion !== defaults.schemaVersion ||
            typeof input.autoFix !== "boolean" ||
            Object.keys(input).some((key) => !["schemaVersion", "autoFix"].includes(key)))
            throw Error("Invalid settings");
        return { ...defaults, autoFix: input.autoFix, path };
    }
    catch {
        throw new InputError(`Cannot read Whodunit settings at ${path}. Check the JSON file before using auto-fix.`);
    }
    finally {
        if (fd !== undefined)
            closeSync(fd);
    }
}
export function writePreferences(autoFix, home) {
    if (typeof autoFix !== "boolean")
        throw new InputError("Choose auto-fix on or off.");
    const snapshot = readPreferences(home), { root, path } = location(home);
    safeParents(root, dirname(path));
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = join(dirname(path), `.settings-${randomUUID()}.json`);
    try {
        writeFileSync(temporary, JSON.stringify({ ...defaults, autoFix }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
        renameSync(temporary, path);
        return { ...snapshot, autoFix };
    }
    finally {
        if (existsSync(temporary))
            unlinkSync(temporary);
    }
}
