import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

// Exercise npm's actual resolver with the exact package argument, a clean cache,
// and an isolated registry serving the verified tarball. No user install/config writes.
const repo = process.cwd();
const pack = JSON.parse(
  fs.readFileSync(".cache/verified-package.json", "utf8"),
);
const manifest = JSON.parse(fs.readFileSync("package.manifest.json", "utf8"));
const tarball = fs.readFileSync(pack.filename);
const base = fs.mkdtempSync(path.resolve(".cache/npx-smoke-"));
const project = path.join(base, "unrelated-project");
fs.mkdirSync(project);
fs.writeFileSync(
  path.join(project, "package.json"),
  '{"name":"unrelated-project","private":true}',
);
let registry;
const server = http.createServer((req, res) => {
  if (req.url === "/package.tgz") {
    res.writeHead(200, { "content-type": "application/octet-stream" });
    res.end(tarball);
  } else if (
    decodeURIComponent(req.url).split("?")[0] === "/@coreplane/whodunit"
  ) {
    const version = {
      ...manifest,
      dist: {
        tarball: `${registry}/package.tgz`,
        integrity: pack.integrity,
        shasum: pack.shasum,
      },
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        name: manifest.name,
        "dist-tags": { latest: manifest.version },
        versions: { [manifest.version]: version },
      }),
    );
  } else {
    res.writeHead(404);
    res.end("{}");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
registry = `http://127.0.0.1:${server.address().port}`;
async function run(cwd, profile, cache) {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["--yes", "@coreplane/whodunit", "--home", profile],
      {
        cwd,
        env: {
          ...process.env,
          npm_config_registry: registry,
          npm_config_cache: cache,
          npm_config_update_notifier: "false",
          npm_config_audit: "false",
          npm_config_userconfig: path.join(base, "empty.npmrc"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    const timer = setTimeout(() => child.kill(), 30000);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(output)
        : reject(Error(`npx exited ${code}: ${output}`));
    });
  });
}
try {
  for (const [index, cwd] of [repo, project].entries()) {
    const profile = path.join(base, `profile-${index}`),
      cache = path.join(base, `cache-${index}`);
    fs.mkdirSync(profile);
    assert.match(await run(cwd, profile, cache), /Whodunit is installed/);
    assert.match(await run(cwd, profile, cache), /already installed/);
    for (const dir of [
      ".agents/skills",
      ".claude/skills",
      ".config/opencode/skills",
    ])
      assert.ok(fs.existsSync(path.join(profile, dir, "whodunit/SKILL.md")));
  }
  assert.ok(!fs.existsSync(path.join(project, ".agents")));
  console.log(
    "Unversioned npx installs from the development checkout and an unrelated project, with user discovery and repeat installation.",
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
