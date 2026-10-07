import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { alreadyPublished } from "../scripts/publication-status.js";

test("release skips only the exact published artifact", () => {
  expect(
    alreadyPublished(
      200,
      { dist: { integrity: "sha512-expected" } },
      "sha512-expected",
    ),
  ).toBe(true);
  expect(alreadyPublished(404, null, "sha512-expected")).toBe(false);
  for (const data of [
    null,
    [],
    {},
    { dist: {} },
    { dist: { integrity: "sha512-other" } },
  ])
    expect(() => alreadyPublished(200, data, "sha512-expected")).toThrow();
  for (const status of [401, 403, 429, 500, 503])
    expect(() => alreadyPublished(status, null, "sha512-expected")).toThrow();
});

test("release entrypoint consumes the package verifier's metadata and writes the publication receipt", () => {
  const script = resolve("scripts/publication-status.ts");
  const root = mkdtempSync(join(tmpdir(), "whodunit-publication-"));
  try {
    mkdirSync(join(root, ".cache"));
    const manifest = { name: "@coreplane/fixture", version: "1.2.3" };
    const bytes = Buffer.from("verified fixture artifact");
    const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    writeFileSync(
      join(root, "package.manifest.json"),
      JSON.stringify(manifest),
    );
    writeFileSync(join(root, "fixture.tgz"), bytes);
    writeFileSync(
      join(root, ".cache/verified-package.json"),
      JSON.stringify({ ...manifest, filename: "fixture.tgz", integrity }),
    );
    const preload = join(root, "registry.ts");
    writeFileSync(
      preload,
      `globalThis.fetch = async (url) => {
      if (url !== "https://registry.npmjs.org/%40coreplane%2Ffixture/1.2.3") throw Error("Unexpected registry request");
      return new Response(JSON.stringify({ dist: { integrity: ${JSON.stringify(integrity)} } }), { status: 200 });
    };`,
    );
    const output = join(root, "github-output");
    const result = Bun.spawnSync({
      cmd: [process.execPath, "--preload", preload, script],
      cwd: root,
      env: { ...process.env, GITHUB_OUTPUT: output },
    });
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    expect(readFileSync(output, "utf8")).toBe("published=true\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
