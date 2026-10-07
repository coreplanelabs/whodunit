import { expect, test } from "bun:test";
import { dispatchCli } from "../src/cli-api.js";
import { codexInlineDirectory } from "../src/inline.js";

const thread = "018bcfe5-6800-7000-8000-000000000001";
test("inline directory follows the thread creation date and host home", () => {
  expect(codexInlineDirectory(thread, "/codex-home")).toBe(
    `/codex-home/visualizations/2023/11/14/${thread}`,
  );
  const legacy = "6553f100-0000-8000-8000-000000000001";
  expect(codexInlineDirectory(legacy, "/codex-home")).toBe(
    `/codex-home/visualizations/2023/11/14/${legacy}`,
  );
  for (const id of [
    undefined,
    "",
    "../../outside",
    "not-a-thread",
    "00000000-0000-4000-8000-000000000001",
  ])
    expect(() => codexInlineDirectory(id, "/codex-home")).toThrow(
      "Codex thread context is unavailable",
    );
});

test("inline delivery returns the saved fragment's reference and fails without one", async () => {
  const report = {
    schemaVersion: "debug-card/1",
    title: "Cause unknown",
    scope: "Selected local evidence",
    rca: {
      summary: "More evidence is needed.",
      assurance: "unknown",
      sourceIds: [],
    },
    sources: [],
  };
  const path = `/codex-home/visualizations/2023/11/14/${thread}/whodunit-report.html`;
  let out = "",
    error = "",
    fragment = "";
  const io = {
    read: () => JSON.stringify(report),
    out: (s: string) => {
      out += s;
    },
    error: (s: string) => {
      error += s;
    },
    inline: (s: string) => {
      fragment = s;
      return path;
    },
  };
  expect(
    await dispatchCli(["card", "/worklog/report.json", "--inline"], io),
  ).toBe(0);
  expect(out).toBe(`visualize${JSON.stringify({ path })}\n`);
  expect(fragment.startsWith("<section")).toBe(true);
  expect(fragment).not.toContain("<!doctype");
  expect(error).toBe("");
  out = "";
  expect(
    await dispatchCli(["card", "report.json", "--inline"], {
      ...io,
      inline: () => {
        throw Error("private host detail");
      },
    }),
  ).toBe(1);
  expect(out).toBe("");
  expect(error).not.toContain("private host detail");
});
