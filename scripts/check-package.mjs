import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const stage = path.resolve(".cache/package");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
for (const name of [
  "bin",
  "skill/whodunit",
  "README.md",
  "LICENSE",
  "THIRD_PARTY.md",
]) {
  fs.mkdirSync(path.dirname(path.join(stage, name)), { recursive: true });
  fs.cpSync(name, path.join(stage, name), { recursive: true });
}
fs.copyFileSync("package.manifest.json", path.join(stage, "package.json"));

const pack = JSON.parse(
  execFileSync("npm", ["pack", stage, "--ignore-scripts", "--json"], {
    encoding: "utf8",
  }),
)[0];
assert.equal(pack.name, "@coreplane/whodunit");
const manifest = JSON.parse(fs.readFileSync("package.manifest.json"));
assert.equal(manifest.license, "MIT");
assert.notEqual(manifest.private, true);
assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
assert.ok(
  pack.files.every(
    (f) =>
      ["package.json", "README.md", "LICENSE", "THIRD_PARTY.md"].includes(
        f.path,
      ) ||
      f.path.startsWith("bin/") ||
      f.path.startsWith("skill/whodunit/"),
  ),
  "Unexpected published file",
);
for (const required of [
  "LICENSE",
  "bin/whodunit.mjs",
  "skill/whodunit/SKILL.md",
  "skill/whodunit/package.json",
  "skill/whodunit/assets/dmsans-OFL.txt",
  "skill/whodunit/assets/dmmono-OFL.txt",
  "skill/whodunit/scripts/lib/index.js",
  "skill/whodunit/scripts/lib/graph.js",
  "skill/whodunit/scripts/lib/inline.js",
  "skill/whodunit/scripts/lib/actions.js",
  "skill/whodunit/scripts/lib/preferences.js",
  "skill/whodunit/references/fixing.md",
  "skill/whodunit/references/writing.md",
])
  assert.ok(
    pack.files.some((f) => f.path === required),
    required,
  );
fs.mkdirSync(".cache", { recursive: true });
fs.writeFileSync(".cache/verified-package.json", JSON.stringify(pack, null, 2));
console.log(
  `Package allowlist passed: ${pack.files.length} files, ${pack.size} bytes, no runtime dependencies.`,
);
