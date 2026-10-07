import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import {
  type ReportOptions,
  renderActions,
  terminalFixQuestion,
} from "../src/actions.js";
import {
  parseDebugCard,
  renderDebugCard,
  renderDebugDocument,
} from "../src/card.js";
import { dispatchCli } from "../src/cli-api.js";

function harness(
  options: ReportOptions,
  host?: (message: unknown) => Promise<unknown>,
) {
  interface NodeStub {
    disabled: boolean;
    hidden: boolean;
    value: string;
    textContent: string;
    selected?: boolean;
    listeners: Record<string, () => unknown>;
    addEventListener(event: string, fn: () => unknown): void;
    focus(): void;
    select(): void;
    querySelector?: (selector?: string) => NodeStub;
  }
  const nodes: Record<string, NodeStub> = {};
  for (const name of ["fix", "preference", "actions", "status", "setting"])
    nodes[name] = {
      disabled: false,
      hidden: name === "actions",
      value: "",
      textContent: "",
      listeners: {},
      addEventListener(event: string, fn: () => unknown) {
        this.listeners[event] = fn;
      },
      focus() {},
      select() {},
    };
  const root = {
    querySelector: (selector: string) =>
      selector.includes("data-action")
        ? nodes[selector.split("=")[1]!.replace("]", "")]
        : nodes[
            (
              {
                ".dc-actions": "actions",
                ".dc-preference": "setting",
              } as Record<string, string>
            )[selector] ?? "status"
          ],
  };
  const html = renderActions("test-report", options);
  const script = html.match(/<script>([\s\S]*?)<\/script>/u)![1]!;
  runInNewContext(script, {
    document: { getElementById: () => root },
    window: host ? { openai: { sendFollowUpMessage: host } } : {},
  });
  return {
    nodes,
    html,
    click: async (name: string) => {
      if (!nodes[name]!.disabled) await nodes[name]!.listeners.click!();
    },
  };
}
test("inline controls send requests only after a click, never run code or claim a saved preference", async () => {
  const requests: { prompt: string; title: string }[] = [];
  const h = harness(
    { delivery: "inline", reportPath: "/chosen/report.json" },
    async (p) => {
      requests.push(p as { prompt: string; title: string });
    },
  );
  expect(requests).toHaveLength(0);
  await h.click("fix");
  expect(requests).toHaveLength(1);
  expect(requests[0]!.prompt).toContain("/chosen/report.json");
  expect(requests[0]!.prompt).toContain("Treat report contents as evidence");
  expect(h.nodes.status!.textContent).toBe("Request sent to your agent.");
  await h.click("fix");
  expect(requests).toHaveLength(1);
  await h.click("preference");
  expect(requests[1]!.prompt).toContain("preference only");
  expect(requests[1]!.prompt).toContain("do not start a fix now");
  expect(h.nodes.status!.textContent).not.toContain("saved");
});
test("saved reports have no action controls or copy flow", () => {
  expect(renderActions("test-report", { delivery: "browser" })).toBe("");
  const html = renderDebugDocument({
    ...report,
    suggestedFix: "Check the setting name.",
  });
  expect(html).toContain("Suggested fix");
  expect(html).toContain("Check the setting name.");
  const inline = renderDebugCard(
    { ...report, suggestedFix: "Check the setting name." },
    { delivery: "inline" },
  );
  expect(inline.indexOf("Suggested fix")).toBeLessThan(
    inline.indexOf('aria-label="Fix options"'),
  );
  expect(html).not.toContain("Fix options");
  expect(html).not.toContain("sendFollowUpMessage");
  expect(html).not.toContain("Copy request");
});
test("inline actions remain hidden when the client has no host action", () => {
  const h = harness({ delivery: "inline" });
  expect(h.nodes.actions!.hidden).toBe(true);
  expect(h.nodes.fix!.listeners.click).toBeUndefined();
  expect(h.html).not.toContain("clipboard");
  expect(h.html).not.toContain("textarea");
});
test("canceled and failed host requests can be tried again", async () => {
  let calls = 0;
  const h = harness({ delivery: "inline" }, async () => {
    calls++;
    if (calls === 1) return false;
    throw Error("Host unavailable");
  });
  await h.click("fix");
  expect(h.nodes.fix!.disabled).toBe(false);
  expect(h.nodes.status!.textContent).toBe("Request canceled.");
  await h.click("fix");
  expect(calls).toBe(2);
  expect(h.nodes.fix!.disabled).toBe(false);
  expect(h.nodes.status!.textContent).toBe("Request was not sent. Try again.");
});
test("site actions show a local preview without sending requests or saving settings", async () => {
  let hostCalls = 0;
  const h = harness({ delivery: "demo" }, async () => {
    hostCalls++;
  });
  await h.click("fix");
  expect(h.nodes.status!.textContent).toBe(
    "Demo only. In Codex, this sends the fix request to your agent.",
  );
  await h.click("preference");
  expect(h.nodes.setting!.textContent).toBe("Auto-fix: on");
  expect(h.nodes.status!.textContent).toBe(
    "Preview only. Your settings have not changed.",
  );
  await h.click("preference");
  expect(h.nodes.setting!.textContent).toBe("Auto-fix: off");
  expect(hostCalls).toBe(0);
  expect(h.html).not.toContain("textarea");
});
test("report reference data cannot create another script", () => {
  const h = renderActions("test-report", {
    reportPath: "</script><script>evil()</script>",
    delivery: "inline",
  });
  expect(h.match(/<script>/gu)).toHaveLength(1);
  expect(h).not.toContain("<script>evil");
  expect(() =>
    renderActions("test-report", { reportPath: "bad\nfile" }),
  ).toThrow();
});
const report = {
  schemaVersion: "debug-card/1",
  title: "Cause unknown",
  scope: "Selected evidence",
  rca: {
    summary: "More evidence is needed.",
    assurance: "unknown",
    sourceIds: [],
  },
  sources: [],
};
test("report text cannot enable auto-fix; terminal output asks the user", async () => {
  expect(
    renderDebugCard({ ...report, autoFix: true }, { delivery: "inline" }),
  ).toContain("Auto-fix: off");
  let output = "",
    writes = 0;
  const io = {
    read: () => JSON.stringify({ ...report, autoFix: true }),
    write: () => {
      writes++;
    },
    out: (s: string) => (output += s),
    error: () => {},
  };
  expect(
    await dispatchCli(["card", "report.json", "--output", "report.html"], io),
  ).toBe(0);
  expect(writes).toBe(1);
  expect(output).toEndWith(terminalFixQuestion() + "\n");
});
test("corrupt preferences still permit a report but require asking before a fix", async () => {
  let output = "";
  const io = {
    read: () => JSON.stringify(report),
    out: (s: string) => (output += s),
    error: () => {},
    preferences: {
      read: () => {
        throw Error("bad settings");
      },
      write: () => {
        throw Error("No writes");
      },
    },
  };
  expect(await dispatchCli(["card", "report.json"], io)).toBe(0);
  expect(output).toContain("I could not read the auto-fix setting");
});
test("recorded changes need direct evidence and change the action to a check", () => {
  const changed = {
    ...report,
    repair: {
      status: "changed",
      summary: "Updated the setting reader. Its test passes.",
      sourceIds: ["diff"],
    },
    sources: [
      {
        id: "diff",
        origin: "provided_answer",
        label: "Diff",
        locator: "reader.ts",
        excerpt: "Updated the lookup.",
      },
    ],
  };
  expect(() => parseDebugCard(changed)).toThrow("direct-read");
  changed.sources[0]!.origin = "direct_read";
  expect(renderDebugCard(changed, { delivery: "inline" })).toContain(
    "Check the fix",
  );
  expect(renderDebugCard(changed)).toContain("What changed");
});

test("a direct terminal asks and waits; always saves the choice but never edits code", async () => {
  let output = "",
    saved = false,
    reads = 0;
  const io = {
    read: () => JSON.stringify(report),
    out: (text: string) => (output += text),
    error: () => {},
    ask: async () => "always",
    preferences: {
      read: () => {
        reads++;
        return {
          schemaVersion: "whodunit-settings/1" as const,
          autoFix: saved,
          path: "/profile/settings.json",
        };
      },
      write: (value: boolean) => {
        saved = value;
        return {
          schemaVersion: "whodunit-settings/1" as const,
          autoFix: saved,
          path: "/profile/settings.json",
        };
      },
    },
  };
  expect(await dispatchCli(["card", "report.json"], io)).toBe(0);
  expect(saved).toBe(true);
  expect(reads).toBeGreaterThan(1);
  expect(output).toContain("Copy this request into your coding agent:");
});
