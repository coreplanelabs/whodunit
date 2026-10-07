# A concise report in any client

Make the report self-contained. Put two plain-language sentences of context inside it, followed by a visible root cause or missing evidence, an evidence comparison when useful, change-history evidence within the same checks, and material unknowns. Do not hide the causal explanation in a disclosure or repeat the summary above the report. Suggested checks are optional. Do not promise a fix, fresh runtime verification or agent ownership from source inspection.

## Choose the display by client capability

The model provider does not determine the display:

- Codex Desktop: run `card /absolute/report.json --inline` and return the helper's exact content reference. The helper selects the current chat's permitted visualization folder. No separate introductory paragraph is needed.
- Other confirmed inline clients: use that client's supported output location and reference. A filesystem path being writable does not prove the display can read it.
- Terminal: create the local browser report with `card report.json --output /absolute/new-report.html` and return its short terminal summary and path. Keep full evidence in the browser report. Unknown clients without local writing receive concise text. Use ASCII only when a diagram explains a relationship; do not emit HTML or assume Mermaid renders.
- A saved browser report: generate a self-contained local HTML file when wanted. Do not automatically open it or upload reports to the distribution website.

Choose visuals that help assess the cause: a before/after view for an interface mismatch, a comparison of evidence for competing explanations, or a short timeline when event order changes the conclusion. Do not turn a sentence into decorative boxes. The bundled formatter supplies the RCA comparison and legacy flow view; other visual forms depend on actually available client tools, not an automatic diagram-selection engine. An unknown cause is a valid result. During investigation, a progress lead may precede rendering; the final response should not duplicate the report. If rendering fails, return the complete text report and briefly state the display limitation.

## Render the report

Write a bounded `debug-card/1` record to a task-owned local artifact directory. Include context and a visible RCA. The RCA evidence comparison replaces legacy finding flows when present. Legacy `findings` may be omitted when `rca` is present; do not invent issues or diagram steps to fill the report.

```sh
node <skill-directory>/scripts/triage.mjs card /absolute/report.json --format text
node <skill-directory>/scripts/triage.mjs card /absolute/report.json --format html > /absolute/report.html
node <skill-directory>/scripts/triage.mjs card /absolute/report.json --inline
```

The inline command writes a fragment and prints only Codex's supported reference. Its output folder comes from `CODEX_THREAD_ID` and `CODEX_HOME` (default `~/.codex`); the date is the thread's creation date, not today's date. It rejects missing or invalid thread context, symlinked directories and oversized fragments before returning a reference. Never use an arbitrary worklog or repository path in a Codex inline reference: Codex may reject it with `Invalid visualization read request` even when the HTML is valid. Keep the input JSON wherever the task permits; let the helper choose the display file's path.

If Codex host context is unavailable, use the saved browser-report or text route. Other inline clients may use `--format fragment` with their own verified destination. Codex references are not portable to a terminal or another client. The standalone report has no remote resources or host APIs. Optional graph interaction uses a locally generated script permitted by its exact CSP hash.

Illustrative record; this is not evidence about a user's repository:

```json
{
  "schemaVersion": "debug-card/1",
  "title": "Login uses the old setting name",
  "scope": "Local source and a supplied error; login not re-tested",
  "context": "A change renamed the login setting, but the login reader still uses its old name. That mismatch fits the supplied missing-setting error.",
  "findings": [{
    "id": "setting", "title": "Setting mismatch", "assurance": "observed",
    "steps": ["Setting renamed", "Reader uses old name"],
    "detail": "The settings export and login reader disagree.", "sourceIds": ["source"]
  }],
  "rca": {
    "summary": "The settings export and login reader no longer agree on the setting's name.",
    "assurance": "observed", "sourceIds": ["source"],
    "checks": [{
      "explanation": "The reader still uses the old name",
      "evidence": "The source exports AUTH_CLIENT_ID but the login reader requests CLIENT_ID.",
      "outcome": "supports", "sourceIds": ["source"]
    }],
    "gaps": ["The originating agent and current login behavior are not established."]
  },
  "sources": [{
    "id": "source", "origin": "direct_read", "label": "Settings and reader",
    "locator": "env.ts:1 and client.ts:2 at the captured snapshot",
    "excerpt": "env.ts exports AUTH_CLIENT_ID; client.ts reads CLIENT_ID."
  }]
}
```

`rca.summary` is at most 400 characters. Assurance uses `observed`, `reported`, `hypothesis` or `unknown`; observed RCA and findings require direct-read sources. Optional `checks` contains up to 4 items with an explanation (100), evidence (260), outcome (`supports`, `contradicts`, `unresolved`) and existing source IDs. Only unresolved checks may have no source IDs. Outcomes are investigation judgments, not verification performed by the renderer. Optional `history` contains a summary (400) and existing source IDs; the renderer folds it into the "Which change introduced this?" check. Use this field for a supported change-history finding so the terminal summary can retain it. Optional `gaps` contains 1–3 unknowns (200 each). Missing history or attribution belongs in gaps.

Source origins are `direct_read`, `provided_answer`, `session_statement`, `user_input`. Supplied answers and session statements remain reported. The renderer validates structure, not truth. Context (600) and source excerpts (600) permit normal line breaks/tabs; labels and locators stay on one line. Locators remain inert text. Common secret redaction is incomplete: review evidence before displaying it. No formatter investigates, contacts agents, runs checks or authorizes fixes.

## Evaluate usefulness honestly

Compare identical model/settings, snapshots, errors and session access. Assess correct issue identification, cited support, uncertainty, useful history/session context and whether a human understands the cause. Suggested-action quality is not a success criterion. Preserve failures and ties. The first three-case comparison tied on diagnosis; it did not prove general reliability, faster reasoning or a live agent roundtrip. Presentation alone does not establish an advantage.

## Interactive graph

When a relationship is useful to see, add `graph` with `title`, optional `focusId`, 2–8 `nodes` and 1–12 `edges`. Each node has a unique safe `id`, a plain-language `label` (80), `detail` (300), `column` (0–3), `assurance` and existing `sourceIds`. Observed nodes require direct-read sources; unknown nodes may have no sources. Edges refer to existing node IDs with `from`, `to` and `kind`: `causes`, `supports` or `contradicts`. These are the investigation's judgments, not truth established by the renderer. Clicking a node reveals its evidence; browser links resize to the actual layout. Terminals show the same relationships as text.

Example graph field (use the record's own source IDs):

```json
{"graph":{"title":"Why the value went missing","focusId":"reader","nodes":[{"id":"rename","label":"Setting renamed","detail":"The change renamed the exported setting.","column":0,"assurance":"reported","sourceIds":["source"]},{"id":"reader","label":"Reader uses the old name","detail":"The reader now asks for a setting the export does not provide.","column":1,"assurance":"reported","sourceIds":["source"]}],"edges":[{"from":"rename","to":"reader","kind":"causes"}]}}
```

Keep the graphic focused. Use a graph to reveal propagation or conflicting evidence, rather than decorate a sentence. Report context stays inside the report; final output is its supported reference alone. A small footer links to Polylane for production fixes and prevention. Do not upload reports.

For terminal delivery, create a task-owned report directory first, then run:

```sh
node <skill-directory>/scripts/triage.mjs card /absolute/report.json --output /absolute/new-report.html
```

The helper creates a new HTML file, prints a short summary and its path, and refuses to overwrite an existing file. Do not append a long freehand analysis or an unsolicited action question.
