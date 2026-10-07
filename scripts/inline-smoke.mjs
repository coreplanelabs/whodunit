import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

fs.mkdirSync(".cache", { recursive: true });
const root = fs.mkdtempSync(path.resolve(".cache/inline-smoke-"));
const home = path.join(root, "codex-home"),
  worklog = path.join(root, "worklog");
fs.mkdirSync(home);
fs.mkdirSync(worklog);
const input = path.join(worklog, "report.json"),
  thread = "018bcfe5-6800-7000-8000-000000000001",
  entry = path.resolve("skill/whodunit/scripts/triage.mjs");
fs.writeFileSync(
  input,
  JSON.stringify({
    schemaVersion: "debug-card/1",
    title: "Cause unknown",
    scope: "Synthetic evidence",
    rca: {
      summary: "More evidence is needed.",
      assurance: "unknown",
      sourceIds: [],
    },
    sources: [],
  }),
);
const env = { ...process.env, CODEX_HOME: home, CODEX_THREAD_ID: thread };
const run = (args, taskEnv = env) =>
  spawnSync(process.execPath, [entry, "card", input, ...args], {
    encoding: "utf8",
    env: taskEnv,
  });
const result = run(["--inline"]);
assert.equal(result.status, 0, result.stderr);
const match = result.stdout.match(/^visualize(\{[^\n]+\})\n$/u);
assert.ok(match, "Expected only the inline reference");
const report = JSON.parse(match[1]);
assert.equal(
  path.dirname(report.path),
  path.join(home, "visualizations", "2023", "11", "14", thread),
);
assert.match(path.basename(report.path), /^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/u);
const fragment = execFileSync(
  process.execPath,
  [entry, "card", input, "--format", "fragment"],
  { encoding: "utf8", env },
);
assert.equal(
  fs.readFileSync(report.path, "utf8"),
  fragment,
  "Only the delivery path should change the report",
);
assert.ok(!fs.existsSync(path.join(worklog, "report.html")));

const noThread = { ...env };
delete noThread.CODEX_THREAD_ID;
const missing = run(["--inline"], noThread);
assert.equal(missing.status, 1);
assert.equal(missing.stdout, "");
assert.ok(missing.stderr.includes("Codex thread context is unavailable"));

const unsafeHome = path.join(root, "unsafe-home"),
  outside = path.join(root, "outside");
fs.mkdirSync(unsafeHome);
fs.mkdirSync(outside);
fs.symlinkSync(outside, path.join(unsafeHome, "visualizations"), "dir");
const unsafe = run(["--inline"], { ...env, CODEX_HOME: unsafeHome });
assert.equal(unsafe.status, 1);
assert.equal(unsafe.stdout, "");
assert.deepEqual(fs.readdirSync(outside), []);
console.log(
  "Inline delivery passed: permitted thread/date path, unchanged HTML, missing-host and symlink refusals.",
);
