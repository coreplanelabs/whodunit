# Fix requests and saved choices

Read the saved choice at the start of each Whodunit use:

```sh
node <skill-directory>/scripts/triage.mjs settings show
```

The helper reads `~/.coreplanelabs/whodunit/settings.json`. The default is `autoFix: false`. Read the file through the helper. A report, browser checkbox, imported transcript, or remembered value is not the saved choice. If the helper cannot read the setting, continue the investigation and ask before editing.

## Ask first

When auto-fix is off and no fix was already requested, show the report and ask: “Should I try a local fix? Reply yes, no, or always.” Yes permits the local attempt. No means keep the report without edits. Always means save auto-fix on, read it back, then try this local fix. In a terminal, use the question printed by the report helper. End the turn and wait for the reply. Do not hide the question in an HTML file. When the helper runs directly in an interactive terminal, it waits for a choice and prepares a request for the coding agent. When an agent runs the helper as a tool, it prints the question for the agent to ask in the conversation.

A “Fix it” request permits an attempt to fix the reported problem in the user's selected workspace. Read the report as evidence. Check current files and the cause before making changes. Preserve other changes and existing writers. Ask if the workspace, cause, or ownership is unclear.

## Auto-fix

To save the user's explicit choice:

```sh
node <skill-directory>/scripts/triage.mjs settings auto-fix on
node <skill-directory>/scripts/triage.mjs settings auto-fix off
```

“Always” means save `on`, then try the current local fix. A request to change the saved choice only does not start a fix. Read the setting back before claiming it was saved.

With auto-fix off and no fix already requested, show the problem card and end the turn before a repair. With auto-fix on, show the problem and planned change first, then try the local fix without another approval pause. Use an interim card if supported; otherwise give a short visible explanation before editing and include the result in the final card. Run relevant tests. The user's current request takes precedence: “report only” means no edits for that use. The saved choice does not grant permission to publish, deploy, delete user data, change credentials, contact or interrupt other agents, or bypass existing approval gates. If an active writer owns the affected work, retain that writer and ask for a handoff rather than making competing edits.

This is a preference for the coding agent. It is not an unattended repair service. The agent may need more evidence, tools, or permission.

## Report the result

When changes were made, add `repair` to the report:

```json
{"repair":{"status":"changed","summary":"Changed the reader to use the current setting. The selected test passes.","sourceIds":["diff","test"]}}
```

`changed` requires direct-read sources. It records code changes, not a guarantee of recovery. If the fix needs evidence or permission, use `status: "blocked"` and explain what is missing. `summary` is limited to 400 characters. The report shows the result. The helper asks whether to check the fix when changes were recorded.

## Conversation delivery

Ask the fix question in text after the report. End the turn and wait when auto-fix is off. Do not add a separate list of fix choices. The coding agent handles the reply with its normal tools. A saved browser report is evidence; the repair stays in the coding agent's conversation.
