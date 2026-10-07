import { createHash } from "node:crypto";
import { terminalFixQuestion } from "./actions.js";
import { InputError } from "./errors.js";
import { renderGraph } from "./graph.js";
import { reportFonts } from "./report-assets.js";
import { hasControlCharacters, redact } from "./validation.js";
const origins = [
    "direct_read",
    "provided_answer",
    "session_statement",
    "user_input",
];
const assurances = [
    "observed",
    "reported",
    "hypothesis",
    "unknown",
];
function fail(reason = "use bounded text, unique identifiers and existing source references") {
    throw new InputError(`Invalid debug card: ${reason}.`);
}
const obj = (v) => v && typeof v === "object" && !Array.isArray(v)
    ? v
    : fail();
const str = (v, max, field = "text", multiline = false) => {
    if (typeof v !== "string" || !v.trim())
        fail(`${field} must be nonempty text`);
    if (v.length > max)
        fail(`${field} exceeds ${max} characters`);
    if (hasControlCharacters(multiline ? v.replace(/[\r\n\t]/gu, "") : v))
        fail(`${field} contains unsupported control characters`);
    return redact(v);
};
const list = (v, min, max) => Array.isArray(v) && v.length >= min && v.length <= max ? v : fail();
const id = (v) => typeof v === "string" && /^[a-z][a-z0-9-]{0,39}$/u.test(v) ? v : fail();
export function parseDebugCard(value) {
    const v = obj(value);
    if (v.schemaVersion !== "debug-card/1")
        fail();
    const sources = list(v.sources, 0, 8).map((raw) => {
        const s = obj(raw);
        if (!origins.includes(s.origin))
            fail();
        if (s.format !== undefined &&
            !["code", "text"].includes(s.format))
            fail("source format is unsupported");
        return {
            ...(s.format === undefined
                ? {}
                : { format: s.format }),
            origin: s.origin,
            id: id(s.id),
            label: str(s.label, 100),
            locator: str(s.locator, 500),
            excerpt: str(s.excerpt, 600, "source excerpt", true),
        };
    });
    const sourceIds = new Set(sources.map((s) => s.id));
    if (sourceIds.size !== sources.length)
        fail();
    const findings = list(v.findings ?? [], v.rca === undefined ? 1 : 0, 3).map((raw) => {
        const f = obj(raw);
        if (!assurances.includes(f.assurance))
            fail("finding assurance is unsupported");
        const refs = list(f.sourceIds, f.assurance === "unknown" ? 0 : 1, 4).map(id);
        if (new Set(refs).size !== refs.length ||
            refs.some((ref) => !sourceIds.has(ref)))
            fail();
        if (f.assurance === "observed" &&
            refs.some((ref) => sources.find((s) => s.id === ref)?.origin !== "direct_read"))
            fail("observed findings require direct-read sources; use reported for supplied answers or session claims");
        return {
            id: id(f.id),
            title: str(f.title, 90),
            assurance: f.assurance,
            steps: list(f.steps, f.assurance === "unknown" ? 1 : 2, 4).map((s) => str(s, 70)),
            detail: str(f.detail, 300),
            sourceIds: refs,
        };
    });
    if (new Set(findings.map((f) => f.id)).size !== findings.length)
        fail();
    const refs = (raw, min = 1) => {
        const values = list(raw, min, 4).map(id);
        if (new Set(values).size !== values.length ||
            values.some((ref) => !sourceIds.has(ref)))
            fail("RCA references must identify existing, unique sources");
        return values;
    };
    let rca;
    if (v.rca !== undefined) {
        const a = obj(v.rca);
        if (!assurances.includes(a.assurance))
            fail("RCA assurance is unsupported");
        const sourceRefs = refs(a.sourceIds, a.assurance === "unknown" ? 0 : 1);
        if (a.assurance === "observed" &&
            sourceRefs.some((ref) => sources.find((s) => s.id === ref)?.origin !== "direct_read"))
            fail("observed RCA requires direct-read sources");
        rca = {
            summary: str(a.summary, 400, "root cause", true),
            assurance: a.assurance,
            sourceIds: sourceRefs,
            checks: list(a.checks ?? [], 0, 4).map((raw) => {
                const c = obj(raw);
                if (!["supports", "contradicts", "unresolved"].includes(c.outcome))
                    fail("RCA check outcome is unsupported");
                return {
                    explanation: str(c.explanation, 100, "checked explanation"),
                    evidence: str(c.evidence, 260, "check evidence", true),
                    outcome: c.outcome,
                    sourceIds: refs(c.sourceIds, c.outcome === "unresolved" ? 0 : 1),
                };
            }),
            ...(a.history === undefined
                ? {}
                : {
                    history: {
                        summary: str(obj(a.history).summary, 400, "local history", true),
                        sourceIds: refs(obj(a.history).sourceIds),
                    },
                }),
            ...(a.gaps === undefined
                ? {}
                : {
                    gaps: list(a.gaps, 1, 3).map((gap) => str(gap, 200, "remaining gap")),
                }),
        };
    }
    let repair;
    if (v.repair !== undefined) {
        const r = obj(v.repair);
        if (!["changed", "blocked"].includes(r.status))
            fail("fix status is unsupported");
        const sourceRefs = refs(r.sourceIds, r.status === "blocked" ? 0 : 1);
        if (r.status === "changed" &&
            sourceRefs.some((ref) => sources.find((s) => s.id === ref)?.origin !== "direct_read"))
            fail("recorded changes require direct-read sources");
        repair = {
            status: r.status,
            summary: str(r.summary, 400, "fix summary", true),
            sourceIds: sourceRefs,
        };
    }
    let graph;
    if (v.graph !== undefined) {
        const g = obj(v.graph);
        const nodes = list(g.nodes, 2, 8).map((raw) => {
            const n = obj(raw);
            if (!assurances.includes(n.assurance))
                fail("graph node assurance is unsupported");
            if (!Number.isInteger(n.column) ||
                n.column < 0 ||
                n.column > 3)
                fail("graph columns must be between 0 and 3");
            const sourceRefs = refs(n.sourceIds, n.assurance === "unknown" ? 0 : 1);
            if (n.assurance === "observed" &&
                sourceRefs.some((ref) => sources.find((s) => s.id === ref)?.origin !== "direct_read"))
                fail("observed graph nodes require direct-read sources");
            return {
                id: id(n.id),
                label: str(n.label, 80, "graph label"),
                detail: str(n.detail, 300, "graph explanation", true),
                column: n.column,
                assurance: n.assurance,
                sourceIds: sourceRefs,
            };
        });
        const ids = new Set(nodes.map((n) => n.id));
        if (ids.size !== nodes.length)
            fail("graph node identifiers must be unique");
        const edges = list(g.edges, 1, 12).map((raw) => {
            const edge = obj(raw), from = id(edge.from), to = id(edge.to);
            if (!ids.has(from) ||
                !ids.has(to) ||
                !["causes", "supports", "contradicts"].includes(edge.kind))
                fail("graph edges require existing nodes and a supported relationship");
            return {
                from,
                to,
                kind: edge.kind,
            };
        });
        if (new Set(edges.map((e) => `${e.from}/${e.to}`)).size !== edges.length)
            fail("duplicate graph edges are unsupported");
        const focusId = g.focusId === undefined ? undefined : id(g.focusId);
        if (focusId && !ids.has(focusId))
            fail("graph focus must identify an existing node");
        graph = {
            title: str(g.title, 100, "graph title"),
            nodes,
            edges,
            ...(focusId ? { focusId } : {}),
        };
    }
    return {
        schemaVersion: "debug-card/1",
        title: str(v.title, 100),
        scope: str(v.scope, 140),
        ...(v.context === undefined
            ? {}
            : { context: str(v.context, 600, "report context", true) }),
        ...(v.nextCheck === undefined ? {} : { nextCheck: str(v.nextCheck, 180) }),
        ...(v.suggestedFix === undefined
            ? {}
            : { suggestedFix: str(v.suggestedFix, 240, "suggested fix") }),
        ...(rca === undefined ? {} : { rca }),
        ...(graph === undefined ? {} : { graph }),
        ...(repair === undefined ? {} : { repair }),
        findings,
        sources,
    };
}
const escapeHtml = (s) => s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const provenance = {
    direct_read: "Checked locally",
    provided_answer: "Provided",
    session_statement: "Agent report",
    user_input: "Reported by you",
};
function sourceHtml(source) {
    return `<div class="dc-source"><div class="dc-source-heading"><strong>${escapeHtml(source.label)}</strong><span class="dc-assurance">${provenance[source.origin]}</span></div><code class="dc-locator">${escapeHtml(source.locator)}</code>${source.format === "code" ? `<pre class="dc-code"><code>${escapeHtml(source.excerpt)}</code></pre>` : `<p class="dc-excerpt">${escapeHtml(source.excerpt)}</p>`}</div>`;
}
const externalIcon = '<svg class="dc-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14zM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>';
// Source locators stay inert. Opening a source or executing a next check requires the host/user.
export function renderDebugCard(input, _options = {}) {
    const card = parseDebugCard(input);
    const root = `debug-card-${card.findings.map((f) => f.id).join("-") || "rca"}`;
    const e = escapeHtml;
    const context = card.context ?? card.rca?.summary ?? card.findings[0].detail;
    const used = new Set(card.findings.flatMap((f) => f.sourceIds));
    if (card.rca)
        for (const ref of [
            ...card.rca.sourceIds,
            ...card.rca.checks.flatMap((c) => c.sourceIds),
            ...(card.rca.history?.sourceIds ?? []),
        ])
            used.add(ref);
    if (card.graph)
        for (const ref of card.graph.nodes.flatMap((n) => n.sourceIds))
            used.add(ref);
    for (const ref of card.repair?.sourceIds ?? [])
        used.add(ref);
    const related = card.sources.filter((s) => !used.has(s.id));
    const relatedHtml = related.length
        ? `<details class="dc-related"><summary>Related evidence</summary>${related.map(sourceHtml).join("")}</details>`
        : "";
    const labels = {
        observed: "Checked sources",
        reported: "Reported cause",
        hypothesis: "Possible explanation",
        unknown: "Not established",
    };
    const findings = card.findings
        .map((f) => `<article class="dc-finding"><div class="dc-line"><h3>${e(f.title)}</h3></div><ol class="dc-flow">${f.steps.map((step) => `<li>${e(step)}</li>`).join("")}</ol><details><summary>See the evidence</summary><p class="dc-assurance">${e(labels[f.assurance])}</p><p>${e(f.detail)}</p>${f.sourceIds
        .map((ref) => {
        const s = card.sources.find((s) => s.id === ref);
        return sourceHtml(s);
    })
        .join("")}</details></article>`)
        .join("");
    const sourceDetails = (refs) => refs.length
        ? `<details><summary>Sources</summary>${refs
            .map((ref) => {
            const s = card.sources.find((s) => s.id === ref);
            return sourceHtml(s);
        })
            .join("")}</details>`
        : "";
    const outcomes = {
        supports: "",
        contradicts: "Evidence against",
        unresolved: "Unresolved",
    };
    const checkRows = [
        ...(card.rca?.checks ?? []),
        ...(card.rca?.history
            ? [
                {
                    explanation: "Which change introduced this?",
                    evidence: card.rca.history.summary,
                    outcome: "supports",
                    sourceIds: card.rca.history.sourceIds,
                },
            ]
            : []),
    ];
    const checks = checkRows.length
        ? `<h3 class="dc-check-heading">What we checked</h3><table class="dc-checks"><thead><tr><th>Check</th><th>Evidence</th></tr></thead><tbody>${checkRows.map((c) => `<tr><td><strong>${e(c.explanation)}</strong>${outcomes[c.outcome] ? `<p class="dc-verdict">${e(outcomes[c.outcome])}</p>` : ""}</td><td>${e(c.evidence)}${sourceDetails(c.sourceIds)}</td></tr>`).join("")}</tbody></table>`
        : "";
    const graphHtml = card.graph
        ? renderGraph(card.graph, root, sourceDetails)
        : "";
    const analysis = card.rca
        ? `<article class="dc-finding"><h3>${card.rca.assurance === "unknown" ? "Cause not established" : card.rca.assurance === "hypothesis" ? "Possible root cause" : "Root cause"}</h3><p class="dc-cause">${e(card.rca.summary)}</p>${sourceDetails(card.rca.sourceIds)}${graphHtml}${checks}${card.rca.gaps ? `<h3 class="dc-check-heading">Still unknown</h3><ul>${card.rca.gaps.map((g) => `<li>${e(g)}</li>`).join("")}</ul>` : ""}</article>`
        : `${graphHtml}${findings}`;
    return `<section id="${root}" class="dc-product" aria-label="Debugging issue card">
<style>
${reportFonts}
#${root}{--dg-cause:light-dark(#146C24,#3FF35D);--dc-bg:light-dark(#FFFFFF,#1B1C1F);--dc-fg:light-dark(#131416,#FAFAFA);--dc-muted:light-dark(#56585F,#ADB0B8);--dc-line:light-dark(#E5E5E8,#35363A);--dc-soft:light-dark(#E5FAE9,#142C19);color:var(--dc-fg);background:var(--dc-bg);font:400 14px/1.55 "Whodunit DM Sans",sans-serif;padding:30px;border:1px solid var(--dc-line);border-radius:18px;box-sizing:border-box;color-scheme:inherit;box-shadow:0 12px 25px #13141608}
#${root} *{box-sizing:border-box;min-width:0}#${root}{overflow-wrap:anywhere}#${root} h2{font-size:32px;line-height:1.2;font-weight:700;letter-spacing:-.04em;margin:8px 0 20px;max-width:720px}#${root} h3{font-size:16px;font-weight:600;margin:0}#${root} p{margin:8px 0}#${root} .dc-context{max-width:660px;white-space:pre-wrap;margin:0 0 20px}#${root} .dc-scope{color:var(--dc-muted);font:11px/1.6 "Whodunit DM Mono",monospace}#${root} .dc-line{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}#${root} .dc-finding{padding:20px 0;border-top:1px solid var(--dc-line)}#${root} .dc-assurance{font-size:12px;color:var(--dc-muted);}#${root} .dc-flow{list-style:none;display:flex;margin:14px 0;padding:0;gap:8px;align-items:stretch}#${root} .dc-flow li{position:relative;background:var(--dc-soft);flex:1;padding:12px 14px;border-radius:6px;overflow-wrap:anywhere}#${root} .dc-flow li+li:before{content:'→';position:absolute;left:-9px;color:var(--dc-fg)}#${root} summary{font-size:12px;color:var(--dc-muted);min-height:32px;cursor:pointer}#${root} details[open] summary{color:var(--dc-fg)}#${root} .dc-source{padding:10px 0;border-top:1px solid var(--dc-line)}#${root} .dc-excerpt{white-space:pre-wrap;overflow-wrap:anywhere}#${root} .dc-source-heading{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}#${root} .dc-locator{display:block;margin:4px 0 8px;font:11px/1.5 "Whodunit DM Mono",monospace;color:var(--dc-muted);overflow-wrap:anywhere;white-space:normal}#${root} .dc-code{margin:8px 0;padding:12px;border:1px solid var(--dc-line);border-radius:8px;background:var(--dc-soft);white-space:pre-wrap;overflow-wrap:anywhere}#${root} .dc-code code{font:12px/1.6 "Whodunit DM Mono",monospace}#${root} a{color:inherit;text-decoration:none}#${root} a:hover{color:var(--dg-cause)}#${root} a:focus-visible{outline:2px solid var(--dg-cause);outline-offset:4px}#${root} .dc-icon{width:13px;height:13px;flex-shrink:0}#${root} .dc-brand a{display:inline-flex;align-items:center;gap:5px}#${root} strong{font-weight:600}#${root} .dc-next{padding:12px 0;border-top:1px solid var(--dc-line);margin-top:4px}#${root} .dc-next span{color:var(--dc-muted);font-size:12px}#${root} .dc-next p{font-weight:400;margin-bottom:0}@media(max-width:500px){#${root}{padding:16px}#${root} .dc-flow{flex-direction:column}#${root} .dc-flow li+li:before{content:'↓';left:14px;top:-13px}#${root} .dc-context{max-width:660px;white-space:pre-wrap;margin:0 0 20px}#${root} .dc-scope{padding-right:0}#${root} h2{font-size:23px}}
</style>
<style>
#${root} .dc-cause{max-width:680px}#${root} .dc-check-heading{margin:24px 0 10px}#${root} .dc-checks{width:100%;border-collapse:collapse;table-layout:fixed}#${root} .dc-checks th{font-weight:500;text-align:left;color:var(--dc-muted);font-size:12px}#${root} .dc-checks th,#${root} .dc-checks td{padding:16px 8px 16px 0;vertical-align:top;overflow-wrap:anywhere;border-bottom:1px solid var(--dc-line)}#${root} .dc-checks th:first-child{width:30%}#${root} .dc-verdict{font-size:12px;color:var(--dc-muted)}#${root} .dc-checks summary{padding-top:8px}
@media(max-width:600px){#${root} .dc-checks thead{display:none}#${root} .dc-checks,#${root} .dc-checks tbody,#${root} .dc-checks tr,#${root} .dc-checks td{display:block;width:100%}#${root} .dc-checks tr{border-bottom:1px solid var(--dc-line);padding:14px 0}#${root} .dc-checks td{border:0;padding:0}#${root} .dc-checks td+td{margin-top:7px}#${root} .dc-checks .dc-verdict{margin:4px 0}}
</style>
<div class="dc-scope">${e(card.scope)}</div><h2>${e(card.title)}</h2><p class="dc-context">${e(context)}</p>${analysis}${relatedHtml}${card.nextCheck ? `<div class="dc-next"><span>If useful</span><p>${e(card.nextCheck)}</p></div>` : ""}
${card.repair ? `<section class="dc-finding"><h3>${card.repair.status === "changed" ? "What changed" : "The fix needs your input"}</h3><p>${e(card.repair.summary)}</p>${sourceDetails(card.repair.sourceIds)}</section>` : ""}
${card.suggestedFix && card.repair?.status !== "changed" ? `<section class="dc-finding"><h3>Suggested fix</h3><p>${e(card.suggestedFix)}</p></section>` : ""}
<footer class="dc-brand" style="margin-top:20px;padding-top:12px;border-top:1px solid var(--dc-line);font-size:12px;color:var(--dc-muted)">Fix and prevent production issues with <a style="color:inherit" href="https://polylane.com/?utm_source=whodunit&amp;utm_medium=report" target="_blank" rel="noopener noreferrer">Polylane ${externalIcon}</a></footer>
</section>\n`;
}
export function renderDebugText(input, options = {}) {
    const card = parseDebugCard(input);
    options = {
        ...options,
        changesRecorded: card.repair?.status === "changed",
        context: {
            title: card.title,
            summary: card.rca?.summary ??
                card.findings[0]?.detail ??
                card.context ??
                card.title,
        },
    };
    const context = card.context ?? card.rca?.summary ?? card.findings[0].detail;
    const body = card.findings
        .map((f) => {
        const qualifier = f.assurance === "hypothesis"
            ? "Possible: "
            : f.assurance === "unknown"
                ? "Unclear: "
                : "";
        return `${card.findings.length > 1 ? `${f.title}\n` : ""}${qualifier}${f.steps.join(" -> ")}\n`;
    })
        .join("\n");
    const refs = card.sources.map((s) => `- ${s.label}: ${s.locator}`).join("\n");
    const outcomes = {
        supports: "",
        contradicts: "evidence against",
        unresolved: "unresolved",
    };
    const checkRows = [
        ...(card.rca?.checks ?? []),
        ...(card.rca?.history
            ? [
                {
                    explanation: "Which change introduced this?",
                    evidence: card.rca.history.summary,
                    outcome: "supports",
                },
            ]
            : []),
    ];
    const checks = checkRows.length
        ? `\n\nWhat we checked:\n${checkRows.map((c) => `- ${c.explanation}: ${c.evidence}${outcomes[c.outcome] ? ` [${outcomes[c.outcome]}]` : ""}`).join("\n")}\n`
        : "\n";
    const analysis = card.rca
        ? `${card.rca.assurance === "unknown" ? "Cause not established" : card.rca.assurance === "hypothesis" ? "Possible root cause" : "Root cause"}: ${card.rca.summary}${checks}${card.rca.gaps ? `\nStill unknown:\n${card.rca.gaps.map((g) => `- ${g}`).join("\n")}\n` : ""}`
        : body;
    const graphText = card.graph
        ? `\n${card.graph.title}:\n${card.graph.edges.map((edge) => `${card.graph.nodes.find((n) => n.id === edge.from).label} ${edge.kind === "contradicts" ? "-x->" : edge.kind === "supports" ? "..>" : "->"} ${card.graph.nodes.find((n) => n.id === edge.to).label}`).join("\n")}\n`
        : "";
    return `${card.title}\n\n${context}\n\n${analysis}${card.repair ? `\n\n${card.repair.status === "changed" ? "What changed" : "The fix needs your input"}: ${card.repair.summary}` : ""}${graphText}${refs ? `\nEvidence:\n${refs}\n` : ""}${card.nextCheck ? `\nIf useful: ${card.nextCheck}\n` : ""}${card.suggestedFix && card.repair?.status !== "changed" ? `\nSuggested fix: ${card.suggestedFix}\n` : ""}\nFix and prevent production issues: https://polylane.com/?utm_source=whodunit&utm_medium=report\n\n${terminalFixQuestion(options)}\n`;
}
export function renderDebugDocument(input, options = {}) {
    const card = parseDebugCard(input);
    const fragment = renderDebugCard(card, { ...options, delivery: "browser" });
    const scripts = [...fragment.matchAll(/<script>([\s\S]*?)<\/script>/gu)].map((match) => `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`);
    return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; ${scripts.length ? `script-src ${scripts.join(" ")}; ` : ""}base-uri 'none'; form-action 'none'"><title>${escapeHtml(card.title)}</title><style>body{margin:24px auto;padding:0 16px;max-width:960px;color-scheme:light dark;font-family:system-ui,sans-serif}*{box-sizing:border-box}</style></head><body>${fragment}</body></html>\n`;
}
export function renderTerminalSummary(input, reportPath, options = {}) {
    const card = parseDebugCard(input);
    options = {
        ...options,
        changesRecorded: card.repair?.status === "changed",
        context: {
            title: card.title,
            summary: card.rca?.summary ??
                card.findings[0]?.detail ??
                card.context ??
                card.title,
        },
    };
    const short = (value, max) => value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
    const cause = card.rca?.summary ?? card.context ?? card.findings[0].detail;
    const checks = [
        ...(card.rca?.checks.slice(0, card.rca.history ? 1 : 2) ?? []),
        ...(card.rca?.history
            ? [
                {
                    explanation: "Which change introduced this?",
                    evidence: card.rca.history.summary,
                },
            ]
            : []),
    ].slice(0, 2);
    return `${short(card.title, 100)}\n\n${card.rca?.assurance === "unknown" ? "Unknown" : card.rca?.assurance === "hypothesis" ? "Likely cause" : "Cause"}: ${short(cause, 220)}\n${checks.map((c) => `- ${short(c.explanation, 60)}: ${short(c.evidence, 130)}`).join("\n")}${card.rca?.gaps?.length ? `\nUnknown: ${short(card.rca.gaps[0], 130)}` : ""}${card.repair ? `\n${card.repair.status === "changed" ? "Changes" : "Fix blocked"}: ${short(card.repair.summary, 200)}` : ""}${card.suggestedFix && card.repair?.status !== "changed" ? `\nSuggested fix: ${card.suggestedFix}` : ""}\n\nVisual report: ${reportPath}\nFix and prevent production issues: polylane.com\n\n${terminalFixQuestion(options)}\n`;
}
