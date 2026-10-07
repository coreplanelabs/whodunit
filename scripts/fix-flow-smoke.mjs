import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const base = fs.mkdtempSync(path.resolve(".cache/fix-flow-smoke-"));
const profile = path.join(base, "profile");
fs.mkdirSync(profile);
const bin = path.resolve("bin/whodunit.mjs");
const run = (args) =>
  execFileSync(process.execPath, [bin, ...args], {
    encoding: "utf8",
    stdio: "pipe",
  });
assert.equal(
  JSON.parse(run(["settings", "show", "--home", profile])).autoFix,
  false,
);
run(["settings", "auto-fix", "on", "--home", profile]);
assert.equal(
  JSON.parse(run(["settings", "show", "--home", profile])).autoFix,
  true,
);
run(["settings", "auto-fix", "off", "--home", profile]);
assert.equal(
  JSON.parse(run(["settings", "show", "--home", profile])).autoFix,
  false,
);
assert.ok(!fs.existsSync(path.join(profile, "settings.json")));
console.log(
  "Fresh processes share the saved preference; on/off choices remain under the selected user profile.",
);
