import { expect, test } from "bun:test";
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
