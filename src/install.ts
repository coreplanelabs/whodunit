import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const owner = "@coreplane/local-debug",
	receiptName = ".local-debug-install.json";
export type InstallAgent = "all" | "codex" | "claude" | "opencode";
export interface InstallReceipt {
	owner: string;
	version: string;
	files: Record<string, string>;
}
const digest = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");
export function targetPaths(agent: InstallAgent): string[] {
	return agent === "claude"
		? [".claude/skills/local-debug"]
		: agent === "all"
			? [".agents/skills/local-debug", ".claude/skills/local-debug"]
			: [".agents/skills/local-debug"];
}
export function validateOwned(
	receipt: unknown,
	actual: Record<string, string>,
): void {
	if (!receipt || typeof receipt !== "object")
		throw Error(
			"An existing skill has no installation receipt; preserve it before installing.",
		);
	const r = receipt as InstallReceipt;
	if (
		r.owner !== owner ||
		!r.files ||
		typeof r.files !== "object" ||
		JSON.stringify(Object.keys(r.files).sort()) !==
			JSON.stringify(Object.keys(actual).sort()) ||
		Object.entries(actual).some(([name, hash]) => r.files[name] !== hash)
	)
		throw Error(
			"An existing skill was edited or is not owned by this installer; preserve it before updating.",
		);
}
function files(directory: string, prefix = ""): Map<string, Uint8Array> {
	const result = new Map<string, Uint8Array>();
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const name = prefix ? `${prefix}/${entry.name}` : entry.name,
			path = join(directory, entry.name);
		if (entry.isSymbolicLink())
			throw Error("Skill files must not be symlinks.");
		if (entry.isDirectory())
			for (const [child, bytes] of files(path, name)) result.set(child, bytes);
		else if (entry.isFile() && name !== receiptName)
			result.set(name, readFileSync(path));
		else if (!entry.isFile())
			throw Error("Skill contents must be regular files.");
	}
	return result;
}
function fileNames(directory: string, prefix = ""): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const name = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isSymbolicLink())
			throw Error("Skill files must not be symlinks.");
		if (entry.isDirectory())
			return fileNames(join(directory, entry.name), name);
		if (!entry.isFile()) throw Error("Skill contents must be regular files.");
		return name === receiptName ? [] : [name];
	});
}
function safeParents(root: string, path: string): void {
	const rel = relative(root, path);
	if (rel.startsWith("..") || rel.startsWith(sep))
		throw Error("Install paths must stay inside the selected project.");
	let current = root;
	for (const part of rel.split(sep)) {
		current = join(current, part);
		if (existsSync(current)) {
			const stat = lstatSync(current);
			if (stat.isSymbolicLink() || !stat.isDirectory())
				throw Error(
					"An install path is a symlink or non-directory; choose a project-local directory.",
				);
		}
	}
}
export function installSkill(
	project: string,
	source: string,
	version: string,
	agent: InstallAgent = "all",
) {
	const root = realpathSync(resolve(project)),
		sourceFiles = files(source);
	if (!sourceFiles.has("SKILL.md"))
		throw Error("The package is missing its skill.");
	const hashes = Object.fromEntries(
		[...sourceFiles].map(([name, bytes]) => [name, digest(bytes)]),
	);
	const targets = targetPaths(agent).map((path) => join(root, path));
	const pending: string[] = [];
	for (const target of targets) {
		safeParents(root, target);
		if (existsSync(target)) {
			const receiptPath = join(target, receiptName);
			if (!existsSync(receiptPath) || lstatSync(receiptPath).isSymbolicLink())
				throw Error(
					"An existing skill is not owned by this installer; preserve it before installing.",
				);
			if (fileNames(target).some((name) => !sourceFiles.has(name)))
				throw Error(
					"An existing skill contains additional files; preserve it before updating.",
				);
			const actual = Object.fromEntries(
				[...files(target)].map(([name, bytes]) => [name, digest(bytes)]),
			);
			let receipt: unknown;
			try {
				receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
			} catch {
				throw Error("Cannot verify the existing skill's installation receipt.");
			}
			validateOwned(receipt, actual);
			if (
				Object.keys(actual).length === Object.keys(hashes).length &&
				Object.entries(actual).every(([name, hash]) => hashes[name] === hash)
			)
				continue;
		}
		pending.push(target);
	}
	if (!pending.length) return { changed: false, targets };
	const stage = join(root, `.local-debug-stage-${randomUUID()}`),
		backupRoot = join(root, ".local-debug", "backups");
	safeParents(root, backupRoot);
	mkdirSync(stage);
	const activated: { target: string; backup?: string }[] = [];
	try {
		for (let i = 0; i < pending.length; i++) {
			const staged = join(stage, String(i));
			mkdirSync(staged);
			for (const [name, bytes] of sourceFiles) {
				const path = join(staged, name);
				mkdirSync(dirname(path), { recursive: true });
				writeFileSync(path, bytes);
			}
			writeFileSync(
				join(staged, receiptName),
				JSON.stringify({ owner, version, files: hashes }, null, 2) + "\n",
			);
		}
		for (let i = 0; i < pending.length; i++) {
			const target = pending[i]!;
			safeParents(root, target);
			mkdirSync(dirname(target), { recursive: true });
			let backup: string | undefined;
			if (existsSync(target)) {
				mkdirSync(backupRoot, { recursive: true });
				backup = join(backupRoot, `${version}-${i}-${randomUUID()}`);
				renameSync(target, backup);
			}
			try {
				renameSync(join(stage, String(i)), target);
			} catch (error) {
				if (backup) renameSync(backup, target);
				throw error;
			}
			activated.push({ target, ...(backup ? { backup } : {}) });
		}
		return {
			changed: true,
			targets,
			backups: activated.flatMap((a) => (a.backup ? [a.backup] : [])),
		};
	} catch (error) {
		for (const entry of activated.reverse()) {
			renameSync(entry.target, join(stage, `rollback-${randomUUID()}`));
			if (entry.backup) renameSync(entry.backup, entry.target);
		}
		throw error;
	} finally {
		rmSync(stage, { recursive: true, force: true });
	}
}
