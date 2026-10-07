import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderDebugCard } from "../skill/whodunit/scripts/lib/card.js";

const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const slug = manifest.name.split("/")[1],
  brand = process.argv[2] ?? "Whodunit",
  repo = manifest.repository.url.replace("git+", "").replace(/\.git$/u, "");
const output = path.resolve(".cache/site");
fs.mkdirSync(output, { recursive: true });
// The old iframe-only demo is superseded by the complete report on the page.
fs.rmSync(path.join(output, "example.html"), { force: true });
const example = renderDebugCard(
  JSON.parse(fs.readFileSync("site/example-report.json", "utf8")),
);
const scripts = [...example.matchAll(/<script>([\s\S]*?)<\/script>/gu)].map(
  (match) =>
    `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`,
);
const html = fs
  .readFileSync("site/index.template.html", "utf8")
  .replaceAll("__BRAND__", brand)
  .replaceAll("__REPO__", repo)
  .replaceAll("__COMMAND__", process.argv[3] ?? `npx ${manifest.name}`)
  .replaceAll("__SLUG__", slug)
  .replace("__EXAMPLE__", example);
fs.writeFileSync(path.join(output, "index.html"), html);
for (const name of ["style.css", "site.js", "theme-init.js", "favicon.svg"])
  fs.copyFileSync(path.join("site", name), path.join(output, name));
fs.mkdirSync(path.join(output, "assets"), { recursive: true });
for (const name of fs.readdirSync("site/assets"))
  fs.copyFileSync(
    path.join("site/assets", name),
    path.join(output, "assets", name),
  );
const csp = `default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self' ${scripts.join(" ")}; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
fs.writeFileSync(
  path.join(output, "_headers"),
  `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: no-store\n`,
);
console.log(output);
