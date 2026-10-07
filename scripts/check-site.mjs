import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const root = ".cache/site";
assert.deepEqual(fs.readdirSync(root).sort(), [
  "_headers",
  "example.html",
  "index.html",
  "site.js",
  "style.css",
]);
const rules = [];
for (const line of fs.readFileSync(`${root}/_headers`, "utf8").split("\n")) {
  if (line.startsWith("/")) rules.push({ route: line, headers: [] });
  else if (line.trim()) rules.at(-1).headers.push(line.trim());
}
const policies = (route) =>
  rules
    .filter((rule) => rule.route === route || rule.route === "/*")
    .flatMap((rule) => rule.headers)
    .filter((header) => header.startsWith("Content-Security-Policy:"));

const example = fs.readFileSync(`${root}/example.html`, "utf8");
const scripts = [...example.matchAll(/<script>([\s\S]*?)<\/script>/gu)];
assert.equal(scripts.length, 1);
const hash = createHash("sha256").update(scripts[0][1]).digest("base64");
for (const route of ["/example", "/example.html"]) {
  const matched = policies(route);
  assert.equal(matched.length, 1, `${route}: overlapping CSP policies`);
  assert.ok(matched[0].includes(`script-src 'sha256-${hash}'`));
  assert.ok(matched[0].includes("frame-ancestors 'self'"));
  assert.ok(matched[0].includes("style-src 'unsafe-inline'"));
}
for (const route of ["/", "/index", "/index.html"]) {
  const matched = policies(route);
  assert.equal(matched.length, 1, `${route}: overlapping CSP policies`);
  assert.ok(matched[0].includes("frame-src 'self'"));
  assert.ok(matched[0].includes("frame-ancestors 'none'"));
}
const index = fs.readFileSync(`${root}/index.html`, "utf8");
assert.ok(index.includes("npx @coreplane/whodunit"));
assert.ok(!/__\w+__/u.test(index), "Unresolved site template value");
console.log(
  "Site checks passed: curated assets and compatible graph policies.",
);
