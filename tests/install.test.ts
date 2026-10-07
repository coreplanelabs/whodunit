import { expect, test } from "bun:test";
import { targetPaths, validateOwned } from "../src/install.js";

test("install scopes cover documented project discovery paths without changing global configuration", () => {
  expect(targetPaths("codex")).toEqual([".agents/skills/whodunit"]);
  expect(targetPaths("opencode")).toEqual([".agents/skills/whodunit"]);
  expect(targetPaths("claude")).toEqual([".claude/skills/whodunit"]);
  expect(targetPaths("all")).toHaveLength(2);
});
test("owned receipts cannot authorize silently replacing edited or additional private files", () => {
  const receipt = {
    owner: "@coreplane/whodunit",
    version: "0.1.0",
    files: { "SKILL.md": "abc" },
  };
  expect(() => validateOwned(receipt, { "SKILL.md": "abc" })).not.toThrow();
  expect(() => validateOwned(receipt, { "SKILL.md": "changed" })).toThrow(
    "edited",
  );
  expect(() =>
    validateOwned(receipt, { "SKILL.md": "abc", "private.txt": "def" }),
  ).toThrow("edited");
  expect(() =>
    validateOwned({ ...receipt, owner: "someone-else" }, { "SKILL.md": "abc" }),
  ).toThrow();
  expect(() => validateOwned(undefined, { "SKILL.md": "abc" })).toThrow();
});
