import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";

export function alreadyPublished(
  status: number,
  metadata: unknown,
  integrity: string,
): boolean {
  if (status === 404) return false;
  if (status !== 200) throw Error(`Registry lookup failed: HTTP ${status}`);
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  )
    throw Error("Registry returned invalid package metadata");
  const dist = (metadata as { dist?: unknown }).dist;
  if (
    dist === null ||
    typeof dist !== "object" ||
    Array.isArray(dist) ||
    (dist as { integrity?: unknown }).integrity !== integrity
  )
    throw Error(
      "Published version differs from the verified artifact; choose a new version",
    );
  return true;
}

if (import.meta.main) {
  const manifest = JSON.parse(readFileSync("package.manifest.json", "utf8")),
    pack = JSON.parse(readFileSync(".cache/verified-package.json", "utf8"));
  if (pack.name !== manifest.name || pack.version !== manifest.version)
    throw Error("Verified package identity differs from the release");
  const integrity = `sha512-${createHash("sha512").update(readFileSync(pack.filename)).digest("base64")}`;
  if (integrity !== pack.integrity)
    throw Error("Verified artifact bytes changed");
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(manifest.name)}/${encodeURIComponent(manifest.version)}`,
    { signal: AbortSignal.timeout(10000) },
  );
  const published = alreadyPublished(
    response.status,
    response.status === 200 ? await response.json() : null,
    integrity,
  );
  if (!process.env.GITHUB_OUTPUT)
    throw Error("Missing GitHub workflow output path");
  appendFileSync(process.env.GITHUB_OUTPUT, `published=${published}\n`);
  console.log(
    published
      ? "This exact artifact is already published."
      : "Verified artifact is ready for publication.",
  );
}
