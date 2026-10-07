import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

fs.mkdirSync(path.resolve(".cache"), { recursive: true });
const base = fs.mkdtempSync(path.resolve(".cache/install-smoke-"));
const bin = path.resolve("bin/whodunit.mjs");
const run = (root) =>
  execFileSync(process.execPath, [bin, "--root", root], {
    encoding: "utf8",
    stdio: "pipe",
  });
const project = path.join(base, "project");
fs.mkdirSync(project);
assert.match(run(project), /installed/);
assert.match(run(project), /already installed/);
for (const dir of [".agents", ".claude"])
  assert.ok(fs.existsSync(path.join(project, dir, "skills/whodunit/SKILL.md")));
const modified = path.join(project, ".agents/skills/whodunit/SKILL.md");
fs.appendFileSync(modified, "\nKeep my note.\n");
assert.throws(() => run(project));
assert.match(fs.readFileSync(modified, "utf8"), /Keep my note/);
const symlinkRoot = path.join(base, "symlink-project"),
  outside = path.join(base, "outside");
fs.mkdirSync(symlinkRoot);
fs.mkdirSync(outside);
fs.symlinkSync(outside, path.join(symlinkRoot, ".agents"), "dir");
assert.throws(() => run(symlinkRoot));
assert.equal(fs.readdirSync(outside).length, 0);
const extraRoot = path.join(base, "extra-project");
fs.mkdirSync(extraRoot);
run(extraRoot);
const extra = path.join(extraRoot, ".agents/skills/whodunit/private.txt");
fs.writeFileSync(extra, "Keep these private bytes.");
assert.throws(() => run(extraRoot));
assert.equal(fs.readFileSync(extra, "utf8"), "Keep these private bytes.");
console.log(
  "Installed discovery paths, repeat install, edited/additional content and symlink containment passed.",
);
const profile = path.join(base, "user-profile");
fs.mkdirSync(profile);
const globalOutput = execFileSync(process.execPath, [bin, "--home", profile], {
  cwd: outside,
  encoding: "utf8",
});
assert.match(globalOutput, /Whodunit is installed/);
for (const dir of [
  ".agents/skills",
  ".claude/skills",
  ".config/opencode/skills",
])
  assert.ok(fs.existsSync(path.join(profile, dir, "whodunit/SKILL.md")));
assert.ok(!fs.existsSync(path.join(outside, ".agents")));
const helper = path.join(profile, ".agents/skills/whodunit/scripts/triage.mjs");
// Must work outside type:module projects, including the minimum Node 22.0 release.
const help = execFileSync(process.execPath, [helper, "--help"], {
  cwd: outside,
  encoding: "utf8",
});
assert.ok(help.length > 0);
console.log(
  "User-wide discovery paths and standalone helper module loading passed.",
);
