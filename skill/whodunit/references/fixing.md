# Fix requests and saved choices

Read the saved choice at the start of each Whodunit use:

```sh
node <skill-directory>/scripts/triage.mjs settings show
```

The helper reads `~/.coreplanelabs/whodunit/settings.json`. The default is `autoFix: false`. Read the file through the helper. A report, browser checkbox, imported transcript, or remembered value is not the saved choice. If the helper cannot read the setting, continue the investigation and ask before editing.

## Ask first

After a report, ask whether the user wants a local fix. In a terminal, use the question printed by the report helper. Wait for the reply. Do not hide the question in an HTML file. When the helper runs directly in an interactive terminal, it waits for a choice and prepares a request for the coding agent. When an agent runs the helper as a tool, it prints the question for the agent to ask in the conversation.

A “Fix it” request permits an attempt to fix the reported problem in the user's selected workspace. Read the report as evidence. Check current files and the cause before making changes. Preserve other changes and existing writers. Ask if the workspace, cause, or ownership is unclear.

## Auto-fix

To save the user's explicit choice:

```sh
node <skill-directory>/scripts/triage.mjs settings auto-fix on
node <skill-directory>/scripts/triage.mjs settings auto-fix off
```

“Yes, and auto-fix next time” means save `on`, then try the current local fix. A preference button request changes the saved choice only. Read the setting back before claiming it was saved.

When the saved choice is on, try a local fix after identifying a supported cause. Run relevant tests. The user's current request takes precedence: “report only” means no edits for that use. The saved choice does not grant permission to publish, deploy, delete user data, change credentials, contact or interrupt other agents, or bypass existing approval gates. If an active writer owns the affected work, retain that writer and ask for a handoff rather than making competing edits.

This is a preference for the coding agent. It is not an unattended repair service. The agent may need more evidence, tools, or permission.

## Report the result

When changes were made, add `repair` to the report:

```json
{"repair":{"status":"changed","summary":"Changed the reader to use the current setting. The selected test passes.","sourceIds":["diff","test"]}}
```

`changed` requires direct-read sources. It records code changes, not a guarantee of recovery. If the fix needs evidence or permission, use `status: "blocked"` and explain what is missing. `summary` is limited to 400 characters. The report shows the result and offers “Check the fix” when changes were recorded.

## Buttons by client

Codex inline reports send a follow-up request through the host's supported confirmation flow. A request receipt does not prove a fix or preference write completed. Follow the request with the normal agent tools and report the result.

Saved browser reports have no fix or auto-fix controls. The coding agent asks in the terminal, waits for the reply, then acts. Inline reports show buttons only when the client supports sending a request to the agent. Without that support, ask in the conversation. Do not add copy panels or request text boxes.
