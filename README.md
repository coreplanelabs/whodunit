# What did I mess up?

A local debugging skill for coding agents. Connect a failure to relevant files, changes and available history, then explain the supported cause in a concise report.

From your project:

```sh
npx @coreplane/whodunit
```

Then ask your coding agent what went wrong. The installer registers the skill for automatic discovery in Codex, Claude Code and OpenCode. If an already-running client caches skills, start a new chat; you do not need to give it a skill-file path.

Reports keep the explanation and sources together. A selectable graph can show the failure path and evidence against it. Terminal clients receive the same facts as text. Suggestions are optional; fixes are not promised. A small footer links to Polylane for production fixes and prevention.

Node 22+. The bounded Git helpers require a committed Git repository; the agent can use its normal file tools otherwise. History and session access depend on the client's actual tools. This package does not install a session bridge, message agents, run fixes, or upload your repository. Common credential redaction is incomplete.

This is experimental. A small prior synthetic comparison did not establish better diagnosis than ordinary Codex.

Development: `bun install`, `bun run verify`. Unit tests use injected I/O; real installation and browser checks run separately.
