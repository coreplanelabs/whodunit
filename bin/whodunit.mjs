#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error("Whodunit requires Node 22 or newer.");
  process.exit(1);
}
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  args = process.argv.slice(2);
if (["local", "history", "card"].includes(args[0])) {
  const { dispatchCli, nativeCliIo } = await import(
    "../skill/whodunit/scripts/lib/cli-api.js"
  );
  process.exitCode = await dispatchCli(args, nativeCliIo());
} else if (args[0] === "--help") {
  console.log(
    "npx @coreplane/whodunit [--root PROJECT] [--agent all|codex|claude|opencode]\nInstall for automatic skill discovery in this project.\nData helpers: local, history, card.",
  );
} else {
  try {
    const options = new Map();
    const start = args[0] === "install" ? 1 : 0;
    for (let i = start; i < args.length; i += 2) {
      const key = args[i],
        value = args[i + 1];
      if (!["--root", "--agent"].includes(key) || !value || options.has(key))
        throw Error(
          "Choose --root PROJECT or --agent all|codex|claude|opencode.",
        );
      options.set(key, value);
    }
    const agent = options.get("--agent") ?? "all";
    if (!["all", "codex", "claude", "opencode"].includes(agent))
      throw Error("Choose a supported agent.");
    const { installSkill } = await import(
      "../skill/whodunit/scripts/lib/install.js"
    );
    const manifest = JSON.parse(
      readFileSync(resolve(packageRoot, "package.json"), "utf8"),
    );
    const result = installSkill(
      options.get("--root") ?? process.cwd(),
      resolve(packageRoot, "skill/whodunit"),
      manifest.version,
      agent,
    );
    console.log(
      result.changed
        ? "Whodunit installed for your coding agents."
        : "Whodunit is already installed.",
    );
    console.log(
      "Ask your agent what went wrong. If it caches skills, start a new chat.",
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Cannot install the skill.",
    );
    process.exitCode = 1;
  }
}
