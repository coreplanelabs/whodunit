import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderGraph } from "../skill/whodunit/scripts/lib/graph.js";

const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const slug = manifest.name.split("/")[1],
  brand = process.argv[2] ?? "Whodunit",
  repo = manifest.repository.url.replace("git+", "").replace(/\.git$/u, "");
const output = path.resolve(".cache/site");
fs.mkdirSync(output, { recursive: true });
const html = fs
  .readFileSync("site/index.template.html", "utf8")
  .replaceAll("__BRAND__", brand)
  .replaceAll("__REPO__", repo)
  .replaceAll("__PACKAGE__", manifest.name)
  .replaceAll("__SLUG__", slug);
fs.writeFileSync(path.join(output, "index.html"), html);
for (const name of ["style.css", "site.js"])
  fs.copyFileSync(path.join("site", name), path.join(output, name));
const graph = {
  title: "Two names. One missing value.",
  focusId: "mismatch",
  nodes: [
    {
      id: "export",
      label: "Setting uses a new name",
      detail: "The example settings now export AUTH_CLIENT_ID.",
      column: 0,
      assurance: "reported",
      sourceIds: [],
    },
    {
      id: "reader",
      label: "Login uses the old name",
      detail: "The example login code still reads CLIENT_ID.",
      column: 0,
      assurance: "reported",
      sourceIds: [],
    },
    {
      id: "mismatch",
      label: "The names no longer match",
      detail:
        "The reader asks for a setting the export no longer provides. Select either input to see the mismatch.",
      column: 1,
      assurance: "reported",
      sourceIds: [],
    },
    {
      id: "missing",
      label: "Login receives no value",
      detail:
        "This illustrative mismatch explains a missing-setting error; it is not evidence about your repository.",
      column: 2,
      assurance: "reported",
      sourceIds: [],
    },
  ],
  edges: [
    { from: "export", to: "mismatch", kind: "supports" },
    { from: "reader", to: "mismatch", kind: "supports" },
    { from: "mismatch", to: "missing", kind: "causes" },
  ],
};
const fragment = renderGraph(graph, "example", () => ""),
  script = [...fragment.matchAll(/<script>([\s\S]*?)<\/script>/gu)][0][1],
  hash = createHash("sha256").update(script).digest("base64");
const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${hash}'; base-uri 'none'; form-action 'none'`;
fs.writeFileSync(
  path.join(output, "example.html"),
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>body{margin:0;color-scheme:light dark;font:400 14px/1.5 system-ui,sans-serif}#example{--dc-bg:light-dark(#fafbf8,#101b1e);--dc-fg:light-dark(#142d35,#edf3ef);--dc-muted:light-dark(#4d696d,#a9c1c2);--dc-line:light-dark(#d7e1db,#304b50);--dc-soft:light-dark(#eef3ef,#183038);color:var(--dc-fg)}h3{font-size:14px;font-weight:500;margin:0}p{margin:6px 0}</style></head><body><div id="example">${fragment}</div></body></html>`,
);
fs.writeFileSync(
  path.join(output, "_headers"),
  `/*\n  Content-Security-Policy: default-src 'none'; style-src 'self'; script-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: no-store\n/example.html\n  Content-Security-Policy: ${csp}; frame-ancestors 'self'\n`,
);
console.log(output);
