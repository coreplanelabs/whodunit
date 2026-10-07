import { expect, test } from "bun:test";
import {
  parseDebugCard,
  renderDebugCard,
  renderDebugDocument,
  renderDebugText,
} from "../src/card.js";
import { dispatchCli } from "../src/cli-api.js";

const fixture = () => ({
  schemaVersion: "debug-card/1",
  title: "Retry never reached review",
  scope: "Reported evidence; not rechecked",
  nextCheck: "Read the target gate before retrying.",
  findings: [
    {
      id: "retry",
      title: "Target missing",
      assurance: "reported",
      steps: ["User retry", "No PR target", "No review started"],
      detail: "The reported trace rejects the target.",
      sourceIds: ["trace"],
    },
  ],
  sources: [
    {
      id: "trace",
      origin: "provided_answer",
      label: "Trace",
      locator: "/selected/trace.txt",
      excerpt: "Request rejected before launch.",
    },
  ],
});
test("different reports with the same finding IDs have separate DOM scopes", () => {
  const first = fixture(),
    second = fixture();
  second.title = "Another retry failed";
  const root = (card: unknown) =>
    renderDebugCard(card).match(/<section id="([^"]+)"/u)![1];
  expect(root(first)).not.toBe(root(second));
  expect(root(first)).toBe(root(first));
});
test("provided answers cannot be promoted to observed facts", () => {
  const f = fixture();
  f.findings[0]!.assurance = "observed";
  expect(() => parseDebugCard(f)).toThrow();
  f.sources[0]!.origin = "direct_read";
  expect(parseDebugCard(f).findings[0]!.assurance).toBe("observed");
});
test("untrusted content is escaped and source locators stay inert", () => {
  const f = fixture();
  f.title = "<img src=x onerror=alert(1)>";
  f.sources[0]!.locator = "javascript:alert(1)";
  f.sources[0]!.excerpt = "</div><script>alert(1)</script>";
  const html = renderDebugCard(f);
  expect(html).toContain("&lt;img");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain('href="javascript:');
  expect(html.match(/href=/gu)).toHaveLength(1);
});
test("unknown cause may be represented with no supporting evidence", () => {
  const f = fixture();
  f.findings[0]!.assurance = "unknown";
  f.findings[0]!.sourceIds = [];
  f.sources = [];
  expect(parseDebugCard(f).findings[0]?.assurance).toBe("unknown");
  expect(renderDebugCard(f)).toContain("Not established");
  f.findings[0]!.assurance = "hypothesis";
  expect(() => parseDebugCard(f)).toThrow();
});
test("orphaned and duplicate source references fail closed", () => {
  const f = fixture();
  f.findings[0]!.sourceIds = ["absent"];
  expect(() => parseDebugCard(f)).toThrow();
  f.findings[0]!.sourceIds = ["trace", "trace"];
  expect(() => parseDebugCard(f)).toThrow();
  f.findings[0]!.sourceIds = ["trace"];
  f.sources.push({ ...f.sources[0]! });
  expect(() => parseDebugCard(f)).toThrow();
});
test("rejects unsupported assurance, origin and oversized records", () => {
  const f = fixture();
  f.findings[0]!.assurance = "verified";
  expect(() => parseDebugCard(f)).toThrow();
  f.findings[0]!.assurance = "reported";
  f.sources[0]!.origin = "verified";
  expect(() => parseDebugCard(f)).toThrow();
  f.sources[0]!.origin = "provided_answer";
  f.title = "x".repeat(101);
  expect(() => parseDebugCard(f)).toThrow();
});
test("identifiers and control characters cannot escape into HTML structure", () => {
  const f = fixture();
  f.findings[0]!.id = 'x" onclick="evil';
  expect(() => parseDebugCard(f)).toThrow();
  f.findings[0]!.id = "retry";
  f.scope = "secret\u0000";
  expect(() => parseDebugCard(f)).toThrow();
});
test("CLI produces a local card and contains read errors without leaking details", async () => {
  let out = "",
    error = "";
  const io = {
    read: () => JSON.stringify(fixture()),
    out: (s: string) => (out += s),
    error: (s: string) => (error += s),
  };
  expect(
    await dispatchCli(["card", "report.json", "--format", "fragment"], io),
  ).toBe(0);
  expect(out).toContain("<details>");
  expect(error).toBe("");
  out = "";
  expect(await dispatchCli(["card"], io)).toBe(2);
  expect(out).toBe("");
  error = "";
  expect(
    await dispatchCli(["card", "bad.json"], {
      ...io,
      read: () => {
        throw Error("private detail");
      },
    }),
  ).toBe(1);
  expect(error).not.toContain("private detail");
});

test("suggestions are optional and never required to identify an issue", () => {
  const { nextCheck: omitted, ...f } = fixture();
  expect(omitted).toBeTruthy();
  expect(parseDebugCard(f).nextCheck).toBeUndefined();
  expect(renderDebugCard(f)).not.toContain("<span>If useful</span>");
  expect(renderDebugCard(fixture())).toContain("<span>If useful</span>");
});

test("normal multiline source quotes render literally while unsafe control bytes still fail", () => {
  const f = fixture();
  f.sources[0]!.excerpt =
    'export const AUTH_CLIENT_ID = "local";\r\nexport const id = config.CLIENT_ID;\t// <script>unsafe()</script>';
  expect(parseDebugCard(f).sources[0]?.excerpt).toContain("\nexport");
  const html = renderDebugCard(f);
  expect(html).toContain('class="dc-excerpt"');
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  f.sources[0]!.excerpt = "source\u0000invalid";
  expect(() => parseDebugCard(f)).toThrow(
    "source excerpt contains unsupported control characters",
  );
});
test("an unknown finding needs no filler step", () => {
  const f = fixture();
  f.findings[0]!.assurance = "unknown";
  f.findings[0]!.steps = ["No fresh error supplied"];
  expect(parseDebugCard(f).findings[0]?.steps).toHaveLength(1);
  f.findings[0]!.assurance = "reported";
  expect(() => parseDebugCard(f)).toThrow();
});
test("mixed source assurance errors name the required correction without leaking data", () => {
  const f = fixture();
  f.findings[0]!.assurance = "observed";
  expect(() => parseDebugCard(f)).toThrow(
    "observed findings require direct-read sources",
  );
});

test("terminal and browser reports carry the same context and evidence without host dependencies", async () => {
  const f = {
    ...fixture(),
    context:
      "The retry never reached the reviewer. Its request did not include the required PR link.",
  };
  const text = renderDebugText(f),
    html = renderDebugDocument(f);
  expect(text).toContain(f.context);
  expect(text).toContain("User retry -> No PR target -> No review started");
  expect(text).toContain("/selected/trace.txt");
  expect(html).toStartWith("<!doctype html>");
  expect(html).toContain(f.context);
  expect(html).toContain("default-src 'none'");
  expect(html).not.toContain("window.openai");
  expect(html).not.toContain("<script");
  let out = "",
    reads = 0;
  const io = {
    read: () => {
      reads++;
      return JSON.stringify(f);
    },
    out: (s: string) => (out += s),
    error: () => {},
  };
  expect(await dispatchCli(["card", "report.json"], io)).toBe(0);
  expect(out).toBe(text);
  expect(
    await dispatchCli(["card", "report.json", "--format", "pdf"], io),
  ).toBe(2);
  expect(reads).toBe(1);
});
test("plain-language context is bounded and escaped in browser reports", () => {
  const f = {
    ...fixture(),
    context:
      'The value is missing. <img src="https://bad.invalid"> is untrusted evidence.',
  };
  expect(renderDebugDocument(f)).not.toContain("<img src=");
  expect(renderDebugDocument(f)).toContain("&lt;img");
  expect(() => parseDebugCard({ ...f, context: "x".repeat(601) })).toThrow(
    "report context exceeds",
  );
});

const rcaFixture = () => ({
  ...fixture(),
  rca: {
    summary: "A shared warning lost the failure reason.",
    assurance: "reported",
    sourceIds: ["trace"],
    checks: [
      {
        explanation: "Permission refused",
        evidence: "No refusal was recorded.",
        outcome: "contradicts",
        sourceIds: ["trace"],
      },
    ],
    history: {
      summary: "The selected change introduced the shared warning.",
      sourceIds: ["trace"],
    },
    gaps: ["The originating agent is not established."],
  },
});
test("RCA preserves provenance and requires evidence for checked explanations and history", () => {
  const f = rcaFixture();
  f.rca.assurance = "observed";
  expect(() => parseDebugCard(f)).toThrow(
    "observed RCA requires direct-read sources",
  );
  f.sources[0]!.origin = "direct_read";
  expect(parseDebugCard(f).rca?.assurance).toBe("observed");
  f.rca.checks[0]!.sourceIds = [];
  expect(() => parseDebugCard(f)).toThrow();
  f.rca.checks[0]!.outcome = "unresolved";
  expect(parseDebugCard(f).rca?.checks[0]?.sourceIds).toEqual([]);
  f.rca.history.sourceIds = ["missing"];
  expect(() => parseDebugCard(f)).toThrow("RCA references");
});
test("RCA remains visible and escaped in text and visual reports, without a filler flow", () => {
  const f = rcaFixture();
  f.rca.summary = "A shared warning <script>bad()</script> lost the reason.";
  const html = renderDebugCard(f),
    text = renderDebugText(f);
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain(f.rca.checks[0]!.evidence);
  expect(html).not.toContain('class="dc-flow"');
  expect(text).toContain(f.rca.summary);
  expect(text).toContain(f.rca.history.summary);
  expect(text).toContain(f.rca.gaps[0]!);
  expect(() =>
    parseDebugCard({ ...f, rca: { ...f.rca, summary: "x".repeat(401) } }),
  ).toThrow("root cause exceeds");
});
test("unresolved RCA cannot become a confirmed cause through formatting", () => {
  const f = rcaFixture();
  f.rca.assurance = "unknown";
  f.rca.sourceIds = [];
  f.rca.checks[0]!.outcome = "unresolved";
  f.rca.checks[0]!.sourceIds = [];
  expect(renderDebugText(f)).toContain("Cause not established:");
  expect(renderDebugCard(f)).toContain("<h3>Cause not established</h3>");
});

test("a cause needs no invented competing explanation or forced comparison", () => {
  const f = rcaFixture();
  const { checks: omitted, history: omittedHistory, ...rca } = f.rca;
  expect(omitted).toHaveLength(1);
  expect(omittedHistory).toBeTruthy();
  const input = { ...f, rca };
  expect(parseDebugCard(input).rca?.checks).toEqual([]);
  expect(renderDebugCard(input)).not.toContain("What we checked");
  expect(renderDebugText(input)).not.toContain("What we checked");
  expect(renderDebugText(input)).toContain(rca.summary);
  const { findings: omittedFindings, ...causeOnly } = input;
  expect(omittedFindings).toHaveLength(1);
  expect(parseDebugCard(causeOnly).findings).toEqual([]);
  expect(renderDebugCard(causeOnly)).toContain(rca.summary);
  expect(renderDebugText(causeOnly)).toContain(rca.summary);
});

test("change history joins the evidence rows without a separate history section", () => {
  const f = rcaFixture(),
    html = renderDebugCard(f),
    text = renderDebugText(f);
  expect(html).toContain("Which change introduced this?");
  expect(html).toContain(f.rca.history.summary);
  expect(html).not.toContain("What local history adds");
  expect(text).not.toContain("What local history adds");
});

const graphFixture = () => ({
  ...rcaFixture(),
  graph: {
    title: "Where the failure spreads",
    focusId: "reader",
    nodes: [
      {
        id: "setting",
        label: "Setting renamed",
        detail: "The name changed.",
        column: 0,
        assurance: "reported",
        sourceIds: ["trace"],
      },
      {
        id: "reader",
        label: "Reader uses old name",
        detail: "The reader and setting disagree.",
        column: 1,
        assurance: "reported",
        sourceIds: ["trace"],
      },
    ],
    edges: [{ from: "setting", to: "reader", kind: "causes" }],
  },
});
test("graphs cannot invent source provenance, references or unsafe identifiers", () => {
  const f = graphFixture();
  f.graph.nodes[0]!.assurance = "observed";
  expect(() => parseDebugCard(f)).toThrow(
    "observed graph nodes require direct-read sources",
  );
  f.graph.nodes[0]!.assurance = "reported";
  f.graph.edges[0]!.to = "absent";
  expect(() => parseDebugCard(f)).toThrow("existing nodes");
  f.graph.edges[0]!.to = "reader";
  f.graph.nodes[0]!.id = 'bad"id';
  expect(() => parseDebugCard(f)).toThrow();
});
test("graph labels and evidence stay escaped; the browser permits only the generated script", () => {
  const f = graphFixture();
  f.graph.nodes[0]!.label = "</script><img onerror=evil()>";
  const html = renderDebugDocument(f),
    text = renderDebugText(f);
  expect(html).toContain("&lt;/script&gt;");
  expect(html).not.toContain("<img onerror");
  expect(html).toContain("script-src 'sha256-");
  expect(html).not.toContain("script-src 'unsafe-inline'");
  expect(html.match(/<script>/gu)).toHaveLength(1);
  expect(html).not.toContain("fetch(");
  expect(text).toContain("-> Reader uses old name");
  expect(html).toContain('data-panel="reader"');
});

test("terminal delivery saves the graph and prints a bounded summary without leaking failed writes", async () => {
  const f = graphFixture();
  let out = "",
    errors = "",
    saved = "";
  const io = {
    read: () => JSON.stringify(f),
    out: (s: string) => {
      out += s;
    },
    error: (s: string) => {
      errors += s;
    },
    write: (_path: string, html: string) => {
      saved = html;
    },
  };
  expect(
    await dispatchCli(["card", "report.json", "--output", "report.html"], io),
  ).toBe(0);
  expect(saved).toContain("dg-map");
  expect(out).toContain("Visual report:");
  expect(out.split("\n").length).toBeLessThanOrEqual(12);
  expect(out).not.toContain("/selected/trace.txt");
  expect(errors).toBe("");
  out = "";
  errors = "";
  expect(
    await dispatchCli(["card", "report.json", "--output", "report.html"], {
      ...io,
      write: () => {
        throw Error("private overwrite detail");
      },
    }),
  ).toBe(1);
  expect(out).toBe("");
  expect(errors).not.toContain("private overwrite detail");
});
