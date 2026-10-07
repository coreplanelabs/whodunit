import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { resolve } from "node:path";
import {
	renderDebugCard,
	renderDebugDocument,
	renderDebugText,
} from "./card.js";
import { InputError } from "./errors.js";
import {
	collectLocal,
	collectLocalHistory,
	type LocalIo,
	validateErrorFile,
} from "./local.js";

const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const parseJson = (text: string): unknown => {
	if (Buffer.byteLength(text) > MAX_INPUT_BYTES)
		throw new InputError("Input exceeds 4 MiB.");
	try {
		return JSON.parse(text);
	} catch {
		throw new InputError("Provide valid JSON.");
	}
};
export interface CliIo {
	read(path: string): string;
	out(text: string): void;
	error(text: string): void;
}
export interface FileIo {
	open(path: string): number;
	stat(fd: number): { isFile(): boolean; size: number };
	read(fd: number, buffer: Buffer, offset: number, length: number): number;
	close(fd: number): void;
}
const fileIo: FileIo = {
	open: (path) =>
		openSync(
			path,
			constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0),
		),
	stat: fstatSync,
	read: (fd, buffer, offset, length) =>
		readSync(fd, buffer, offset, length, null),
	close: closeSync,
};
export function readBounded(path: string, io: FileIo = fileIo): string {
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
			if (read === 0) break;
			length += read;
		}
		if (length > MAX_INPUT_BYTES)
			throw new InputError("Input exceeds 4 MiB; provide a bounded export.");
		return new TextDecoder("utf-8", { fatal: true }).decode(
			buffer.subarray(0, length),
		);
	} finally {
		io.close(fd);
	}
}

export async function dispatchCli(
	args: string[],
	io: CliIo,
	_env: unknown = {},
	_dependencies: unknown = {},
	localIo?: LocalIo,
): Promise<number> {
	if (args.length === 1 && args[0] === "--help") {
		io.out(
			"local-debug local --help\nlocal-debug history --help\nlocal-debug card --help\n",
		);
		return 0;
	}
	if (args[0] === "history") {
		const usage =
			"local-debug history --repo PATH --path FILE [--search LITERAL]\nRead up to three relevant local Git changes; no inference, network or session messages.\n";
		if (args.length === 2 && args[1] === "--help") {
			io.out(usage);
			return 0;
		}
		try {
			const options = new Map<string, string>();
			for (let i = 1; i < args.length; i += 2) {
				const key = args[i],
					value = args[i + 1];
				if (
					!key ||
					!["--repo", "--path", "--search"].includes(key) ||
					options.has(key) ||
					!value
				)
					throw new InputError("Invalid or duplicate history option.");
				options.set(key, value);
			}
			const repository = options.get("--repo"),
				path = options.get("--path");
			if (!repository || !path)
				throw new InputError("Choose --repo PATH and --path FILE.");
			io.out(
				`${JSON.stringify(collectLocalHistory({ repository, path, ...(options.has("--search") ? { search: options.get("--search")! } : {}) }, localIo), null, 2)}\n`,
			);
			return 0;
		} catch (error) {
			io.error(
				`${error instanceof InputError ? error.message : "Cannot read selected local history; check Git and committed HEAD."}\n`,
			);
			return 1;
		}
	}
	if (args[0] === "card") {
		const usage =
			"local-debug card <report.json> [--format text|html|fragment]\nText is the default; HTML is a standalone local browser report; fragment is for supported inline viewers.\n";
		if (args.length === 2 && args[1] === "--help") {
			io.out(usage);
			return 0;
		}
		const format = args.length === 2 ? "text" : args[3];
		if (
			![2, 4].includes(args.length) ||
			!args[1] ||
			args[1].startsWith("-") ||
			(args.length === 4 && args[2] !== "--format") ||
			!["text", "html", "fragment"].includes(format ?? "")
		) {
			io.error(usage);
			return 2;
		}
		try {
			const data = parseJson(io.read(args[1]));
			io.out(
				format === "html"
					? renderDebugDocument(data)
					: format === "fragment"
						? renderDebugCard(data)
						: renderDebugText(data),
			);
			return 0;
		} catch (error) {
			io.error(
				`${error instanceof InputError ? error.message : "Cannot read local decision card."}\n`,
			);
			return 1;
		}
	}
	if (args[0] === "local") {
		if (args.length === 2 && args[1] === "--help") {
			io.out(
				"local-debug local --repo PATH [--symptom TEXT] [--error-file LOG]\nCollect bounded local Git/source/error context for your existing agent.\nNo network, inference, recovery or agent messages. Your coding agent interprets the context; session tools depend on its client.\n",
			);
			return 0;
		}
		try {
			const options = new Map<string, string>();
			for (let i = 1; i < args.length; i += 2) {
				const key = args[i],
					value = args[i + 1];
				if (
					!key ||
					!["--repo", "--symptom", "--error-file"].includes(key) ||
					options.has(key) ||
					!value ||
					value.startsWith("--")
				)
					throw new InputError("Invalid or duplicate local option.");
				options.set(key, value);
			}
			const repository = options.get("--repo");
			if (!repository) throw new InputError("Choose --repo PATH.");
			const file = options.get("--error-file");
			if (file) validateErrorFile(file);
			const result = collectLocal(
				{
					repository,
					...(options.has("--symptom")
						? { symptom: options.get("--symptom")! }
						: {}),
					...(file
						? { errorLog: io.read(file), errorLogLocator: resolve(file) }
						: {}),
				},
				localIo,
			);
			io.out(`${JSON.stringify(result, null, 2)}\n`);
			return 0;
		} catch (error) {
			io.error(
				`${error instanceof InputError ? error.message : "Cannot read local repository context; check Git, committed HEAD and selected paths."}\n`,
			);
			return 1;
		}
	}
	io.error("Choose local, history or card.\n");
	return 2;
}
