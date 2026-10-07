import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const pack = JSON.parse(
  execFileSync("npm", ["pack", "--ignore-scripts", "--json"], {
    encoding: "utf8",
  }),
)[0];
assert.equal(pack.name, "@coreplane/whodunit");
const manifest = JSON.parse(fs.readFileSync("package.json"));
assert.equal(manifest.license, "MIT");
assert.notEqual(manifest.private, true);
assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
assert.ok(
  pack.files.every(
    (f) =>
      ["package.json", "README.md", "LICENSE"].includes(f.path) ||
      f.path.startsWith("bin/") ||
      f.path.startsWith("skill/whodunit/"),
  ),
  "Unexpected published file",
);
for (const required of [
  "LICENSE",
  "bin/whodunit.mjs",
  "skill/whodunit/SKILL.md",
  "skill/whodunit/scripts/lib/index.js",
  "skill/whodunit/scripts/lib/graph.js",
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
