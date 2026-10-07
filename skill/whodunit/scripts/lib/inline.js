import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { InputError } from "./errors.js";
export function codexInlineDirectory(threadId, codexHome) {
    let timestamp;
    if (threadId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(threadId)) {
        timestamp = Number.parseInt(threadId.replaceAll("-", "").slice(0, 12), 16);
    }
    else if (threadId &&
        /^[0-9a-f]{8}-[0-9a-f]{3}[048c]-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(threadId)) {
        timestamp = Number.parseInt(threadId.slice(0, 8), 16) * 1000;
    }
    else {
        throw new InputError("Codex thread context is unavailable. Use --output for a local browser report.");
    }
    // Codex derives the folder date from the thread ID, not today's date.
    const date = new Date(timestamp);
    return join(resolve(codexHome), "visualizations", String(date.getUTCFullYear()), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0"), threadId);
}
export function saveCodexInline(fragment, threadId, codexHome) {
    // Validate host context before creating directories or reading filesystem state.
    codexInlineDirectory(threadId, codexHome);
    if (Buffer.byteLength(fragment) > 1_000_000)
        throw new InputError("Inline report exceeds 1 MB; use a bounded report.");
    const home = realpathSync(resolve(codexHome)), directory = codexInlineDirectory(threadId, home);
    let current = home;
    for (const part of relative(home, directory).split(/[\\/]/u)) {
        current = join(current, part);
        try {
            mkdirSync(current);
        }
        catch (error) {
            if (error.code !== "EEXIST")
                throw error;
        }
        const stat = lstatSync(current);
        if (!stat.isDirectory() || stat.isSymbolicLink())
            throw new InputError("Inline report directory must contain only real directories.");
    }
    const path = join(directory, `whodunit-report-${randomUUID()}.html`);
    writeFileSync(path, fragment, { flag: "wx" });
    return path;
}
