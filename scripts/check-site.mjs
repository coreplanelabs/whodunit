import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = ".cache/site";
assert.deepEqual(fs.readdirSync(root).sort(), [
  "_headers",
  "assets",
  "favicon.svg",
  "index.html",
  "site.js",
  "style.css",
  "theme-init.js",
]);
const expectedAssets = [
  "dm-mono-latin-400-normal.woff",
  "dm-sans-latin-400-normal.woff",
  "dm-sans-latin-500-normal.woff",
  "dm-sans-latin-600-normal.woff",
  "dm-sans-latin-700-normal.woff",
  "dmmono-OFL.txt",
  "dmsans-OFL.txt",
  "fontawesome-LICENSE.txt",
].sort();
assert.deepEqual(
  fs.readdirSync(path.join(root, "assets")).sort(),
  expectedAssets,
);
const html = fs.readFileSync(`${root}/index.html`, "utf8"),
  headers = fs.readFileSync(`${root}/_headers`, "utf8");
assert.equal(headers.match(/Content-Security-Policy:/gu)?.length, 1);
assert.ok(headers.includes("font-src 'self'"));
assert.ok(headers.includes("frame-ancestors 'none'"));
assert.ok(!headers.includes("script-src 'unsafe-inline'"));
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gu)];
assert.ok(scripts.length >= 1, "Expected report interactions");
for (const match of scripts) {
  const hash = createHash("sha256").update(match[1]).digest("base64");
  assert.ok(
    headers.includes(`'sha256-${hash}'`),
    "Inline graph script must match its CSP hash",
  );
}
for (const match of html.matchAll(/(?:src|href)="(\/[^"#]+)"/gu))
  assert.ok(
    fs.existsSync(path.join(root, match[1])),
    `Missing local asset ${match[1]}`,
  );
assert.ok(html.includes("npx @coreplane/whodunit"));
assert.ok(
  !html.includes("npx github:") && !html.includes("npx @coreplane/whodunit@"),
);
assert.ok(
  html.includes("Root cause") &&
    html.includes("dg-map") &&
    html.includes("What we checked") &&
    html.includes("Still unknown"),
);
assert.ok(html.includes("Suggested fix"));
for (const action of ["fix-it", "auto-fix"])
  assert.ok(
    html.includes(
      `href="https://polylane.com/?utm_source=whodunit&amp;utm_medium=example&amp;utm_content=${action}" target="_blank" rel="noopener noreferrer"`,
    ),
  );
assert.ok(
  html.indexOf("Suggested fix") < html.indexOf('aria-label="Fix options"'),
);
assert.ok(
  !html.includes("sendFollowUpMessage") && !html.includes("Preview only."),
);
assert.ok(!/__\w+__/u.test(html), "Unresolved site template value");
console.log(
  "Site checks passed: full example, current npm command, local assets and graph CSP.",
);
