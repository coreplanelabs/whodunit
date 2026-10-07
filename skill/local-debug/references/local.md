# Local evidence helpers

`node <skill-directory>/scripts/triage.mjs local --repo PATH --symptom TEXT [--error-file LOG]` gathers bounded current Git/source/error context. It captures at most six supported source paths, an 8-KiB diff, 2-KiB new-file excerpts and a 4-KiB error excerpt within five seconds. A clean source tree falls back to the latest commit versus its first parent; exclusions remain gaps.

`node <skill-directory>/scripts/triage.mjs history --repo PATH --path FILE [--search LITERAL]` gathers up to three relevant changes for one explicitly selected repository-relative file, including config files. It captures full commit/first-parent references and at most 2 KiB of patch per change. A literal search prioritizes its matching textual hunk. Omitted hunks, failed reads, missing history and changing HEAD remain explicit. Git search finds changes in occurrence count, not every semantic modification; it does not follow renamed paths or other branches.

Both helpers read local evidence without application commands, network or agent messages. Git transports, lazy fetch, hooks, fsmonitor, filters, external diff/textconv and object replacements are disabled. Paths are literal. Sensitive paths are excluded. Common secret redaction is incomplete. They do not infer cause, ownership or author intent from history.

Use current files, user-selected memory and the client's actual session tools to interpret these records. Native session access varies by client. Read only relevant history; ask for explicit human authorization before messaging another session. Do not add an adapter or scan private session databases. A session's statement remains a claim until supported by an edit or other direct evidence.
