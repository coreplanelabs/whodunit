import { closeSync, constants, fstatSync, openSync, readSync, writeFileSync, } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fixRequest, terminalFixQuestion, } from "./actions.js";
import { parseDebugCard, renderDebugCard, renderDebugDocument, renderDebugText, renderTerminalSummary, } from "./card.js";
import { InputError } from "./errors.js";
import { saveCodexInline } from "./inline.js";
import { collectLocal, collectLocalHistory, validateErrorFile, } from "./local.js";
import { readPreferences, writePreferences, } from "./preferences.js";
import { hasControlCharacters } from "./validation.js";
const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const parseJson = (text) => {
    if (Buffer.byteLength(text) > MAX_INPUT_BYTES)
        throw new InputError("Input exceeds 4 MiB.");
    try {
        return JSON.parse(text);
    }
    catch {
        throw new InputError("Provide valid JSON.");
    }
};
export function nativeCliIo(preferencesHome = homedir()) {
    return {
        read: readBounded,
        ...(process.stdin.isTTY && process.stdout.isTTY
            ? {
                ask: async (question) => {
                    const terminal = createInterface({
                        input: process.stdin,
                        output: process.stdout,
                    });
                    try {
                        return await terminal.question(question);
                    }
                    finally {
                        terminal.close();
                    }
                },
            }
            : {}),
        preferences: {
            read: (home) => readPreferences(home ?? preferencesHome),
            write: (value, home) => writePreferences(value, home ?? preferencesHome),
        },
        write: (path, text) => writeFileSync(path, text, { flag: "wx" }),
        inline: (fragment) => saveCodexInline(fragment, process.env.CODEX_THREAD_ID, process.env.CODEX_HOME ?? resolve(homedir(), ".codex")),
        out: (text) => process.stdout.write(text),
        error: (text) => process.stderr.write(text),
    };
}
const fileIo = {
    open: (path) => openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0)),
    stat: fstatSync,
    read: (fd, buffer, offset, length) => readSync(fd, buffer, offset, length, null),
    close: closeSync,
};
export function readBounded(path, io = fileIo) {
    const fd = io.open(path);
    try {
        const stat = io.stat(fd);
        if (!stat.isFile())
            throw new InputError("Evidence must be a regular local JSON file.");
        if (stat.size > MAX_INPUT_BYTES)
            throw new InputError("Input exceeds 4 MiB; provide a bounded export.");
        const buffer = Buffer.alloc(MAX_INPUT_BYTES + 1);
        let length = 0;
        while (length < buffer.length) {
            const read = io.read(fd, buffer, length, buffer.length - length);
            if (read === 0)
                break;
            length += read;
        }
        if (length > MAX_INPUT_BYTES)
            throw new InputError("Input exceeds 4 MiB; provide a bounded export.");
        return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
    }
    finally {
        io.close(fd);
    }
}
export async function dispatchCli(args, io, _env = {}, _dependencies = {}, localIo) {
    if (args.length === 1 && args[0] === "--help") {
        io.out("whodunit local --help\nwhodunit history --help\nwhodunit card --help\nwhodunit settings --help\n");
        return 0;
    }
    if (args[0] === "settings") {
        const usage = "whodunit settings [show | auto-fix on | auto-fix off] [--home DIRECTORY]\nSave your choice for future Whodunit uses. Your agent may ask if evidence or permission is missing.\n";
        if (args[1] === "--help") {
            io.out(usage);
            return 0;
        }
        try {
            if (!io.preferences)
                throw new InputError("This client cannot read or save Whodunit settings.");
            const remaining = args.slice(1);
            const index = remaining.indexOf("--home");
            let home;
            if (index !== -1) {
                home = remaining[index + 1];
                if (!home || hasControlCharacters(home) || home.startsWith("-"))
                    throw new InputError("Choose a valid home folder.");
                remaining.splice(index, 2);
            }
            const showing = remaining.length === 0 ||
                (remaining.length === 1 && remaining[0] === "show");
            if (!showing &&
                !(remaining.length === 2 &&
                    remaining[0] === "auto-fix" &&
                    ["on", "off"].includes(remaining[1])))
                throw new InputError(usage.trim());
            const result = showing
                ? io.preferences.read(home)
                : io.preferences.write(remaining[1] === "on", home);
            io.out(JSON.stringify(result, null, 2) + "\n");
            return 0;
        }
        catch (error) {
            io.error((error instanceof InputError
                ? error.message
                : "Cannot read or save Whodunit settings.") + "\n");
            return 1;
        }
    }
    const reportOptions = (input) => {
        if (hasControlCharacters(input))
            throw new InputError("Choose a valid local report path.");
        let autoFix = false;
        let settingsUnavailable = false;
        try {
            autoFix = io.preferences?.read().autoFix ?? false;
        }
        catch {
            autoFix = false;
            settingsUnavailable = true;
        }
        return {
            reportPath: resolve(input),
            autoFix,
            settingsUnavailable,
            interactive: !!io.ask,
        };
    };
    const askForFix = async (options) => {
        if (!io.ask)
            return;
        const reply = (await io.ask("Create a fix request for your coding agent? [yes/no/always] "))
            .trim()
            .toLowerCase();
        if (["", "no", "n"].includes(reply))
            return;
        if (!["yes", "y", "always"].includes(reply)) {
            io.out("No request created. Choose yes, no, or always next time.\n");
            return;
        }
        if (reply === "always") {
            if (!io.preferences)
                throw new InputError("This client cannot save auto-fix. Use your coding agent to save the choice.");
            io.preferences.write(true);
            if (!io.preferences.read().autoFix)
                throw new InputError("The auto-fix choice was not saved.");
            io.out("Auto-fix is saved for future Whodunit uses.\n");
        }
        io.out(`\nCopy this request into your coding agent:\n${fixRequest(options)}\n`);
    };
    if (args[0] === "history") {
        const usage = "whodunit history --repo PATH --path FILE [--search LITERAL]\nRead up to three relevant local Git changes; no inference, network or session messages.\n";
        if (args.length === 2 && args[1] === "--help") {
            io.out(usage);
            return 0;
        }
        try {
            const options = new Map();
            for (let i = 1; i < args.length; i += 2) {
                const key = args[i], value = args[i + 1];
                if (!key ||
                    !["--repo", "--path", "--search"].includes(key) ||
                    options.has(key) ||
                    !value)
                    throw new InputError("Invalid or duplicate history option.");
                options.set(key, value);
            }
            const repository = options.get("--repo"), path = options.get("--path");
            if (!repository || !path)
                throw new InputError("Choose --repo PATH and --path FILE.");
            io.out(`${JSON.stringify(collectLocalHistory({ repository, path, ...(options.has("--search") ? { search: options.get("--search") } : {}) }, localIo), null, 2)}\n`);
            return 0;
        }
        catch (error) {
            io.error(`${error instanceof InputError ? error.message : "Cannot read selected local history; check Git and committed HEAD."}\n`);
            return 1;
        }
    }
    if (args[0] === "card") {
        const usage = "whodunit card <report.json> [--format text|html|fragment]\nText is the default; HTML is a standalone local browser report; fragment is for supported inline viewers.\n";
        if (args.length === 2 && args[1] === "--help") {
            io.out(usage +
                "whodunit card <report.json> --inline\nSave in this Codex thread's visualization folder and ask the fix question in text.\n" +
                "whodunit card <report.json> --output REPORT.html\nSave the interactive browser report and print a short terminal summary.\n");
            return 0;
        }
        if (args.length === 3 && args[2] === "--inline") {
            try {
                if (!args[1] || args[1].startsWith("-"))
                    throw new InputError("Choose a report JSON file.");
                if (!io.inline)
                    throw new InputError("This client cannot save a Codex inline report. Use --output for a browser report.");
                const card = parseDebugCard(parseJson(io.read(args[1])));
                const options = {
                    ...reportOptions(args[1]),
                    changesRecorded: card.repair?.status === "changed",
                };
                const fragment = renderDebugCard(card);
                const question = terminalFixQuestion({
                    ...options,
                    interactive: false,
                });
                const path = io.inline(fragment);
                io.out(`visualize${JSON.stringify({ path })}\n\n${question}\n`);
                return 0;
            }
            catch (error) {
                io.error(`${error instanceof InputError ? error.message : "Cannot save the inline report in the Codex visualization folder."}\n`);
                return 1;
            }
        }
        if (args.length === 4 && args[2] === "--output") {
            try {
                const target = args[3];
                if (!target ||
                    !target.endsWith(".html") ||
                    hasControlCharacters(target) ||
                    target.includes("://"))
                    throw new InputError("Choose a local .html report path.");
                if (!args[1] || args[1].startsWith("-"))
                    throw new InputError("Choose a report JSON file.");
                if (!io.write)
                    throw new InputError("This client cannot save a browser report.");
                const data = parseJson(io.read(args[1])), path = resolve(target), options = reportOptions(args[1]), html = renderDebugDocument(data);
                io.write(path, html);
                io.out(renderTerminalSummary(data, path, options));
                await askForFix(options);
                return 0;
            }
            catch (error) {
                io.error(`${error instanceof InputError ? error.message : "Cannot save the report; choose a new file in an existing local directory."}\n`);
                return 1;
            }
        }
        const format = args.length === 2 ? "text" : args[3];
        if (![2, 4].includes(args.length) ||
            !args[1] ||
            args[1].startsWith("-") ||
            (args.length === 4 && args[2] !== "--format") ||
            !["text", "html", "fragment"].includes(format ?? "")) {
            io.error(usage);
            return 2;
        }
        try {
            const data = parseJson(io.read(args[1]));
            io.out(format === "html"
                ? renderDebugDocument(data)
                : format === "fragment"
                    ? renderDebugCard(data)
                    : renderDebugText(data, reportOptions(args[1])));
            if (format === "text")
                await askForFix(reportOptions(args[1]));
            return 0;
        }
        catch (error) {
            io.error(`${error instanceof InputError ? error.message : "Cannot read local decision card."}\n`);
            return 1;
        }
    }
    if (args[0] === "local") {
        if (args.length === 2 && args[1] === "--help") {
            io.out("whodunit local --repo PATH [--symptom TEXT] [--error-file LOG]\nCollect bounded local Git/source/error context for your existing agent.\nNo network, inference, recovery or agent messages. Your coding agent interprets the context; session tools depend on its client.\n");
            return 0;
        }
        try {
            const options = new Map();
            for (let i = 1; i < args.length; i += 2) {
                const key = args[i], value = args[i + 1];
                if (!key ||
                    !["--repo", "--symptom", "--error-file"].includes(key) ||
                    options.has(key) ||
                    !value ||
                    value.startsWith("--"))
                    throw new InputError("Invalid or duplicate local option.");
                options.set(key, value);
            }
            const repository = options.get("--repo");
            if (!repository)
                throw new InputError("Choose --repo PATH.");
            const file = options.get("--error-file");
            if (file)
                validateErrorFile(file);
            const result = collectLocal({
                repository,
                ...(options.has("--symptom")
                    ? { symptom: options.get("--symptom") }
                    : {}),
                ...(file
                    ? { errorLog: io.read(file), errorLogLocator: resolve(file) }
                    : {}),
            }, localIo);
            io.out(`${JSON.stringify(result, null, 2)}\n`);
            return 0;
        }
        catch (error) {
            io.error(`${error instanceof InputError ? error.message : "Cannot read local repository context; check Git, committed HEAD and selected paths."}\n`);
            return 1;
        }
    }
    io.error("Choose local, history or card.\n");
    return 2;
}
