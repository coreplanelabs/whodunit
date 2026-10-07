# Whodunit

**Find the change behind the failure.**

Whodunit is a debugging skill for coding agents. It connects a problem to local code, relevant changes and available agent history, then explains the supported cause with evidence.

## Install

Run inside your project:

```sh
npx github:coreplanelabs/whodunit
```

The first npm release is pending publication. After it is published, the registry command is:

```sh
npx @coreplane/whodunit
```

The installer registers the skill for Codex, Claude Code and OpenCode. It leaves your project dependencies alone and preserves edited or unrelated skill files. To target one client, add `--agent codex`, `--agent claude`, or `--agent opencode`. If a running client caches skills, start a new chat.

## Use

Ask your agent what went wrong, or invoke the skill directly:

```text
/whodunit Investigate why login stopped working.
```

Claude Code and OpenCode use `/whodunit`; Codex supports `$whodunit`. Give the actual symptom or error. You do not need to tell the agent to read a skill-file path.

Supported visual clients get a concise report with selectable graph nodes and sources. Terminals get a short summary plus a saved local browser report. Context and change-history evidence stay in the same report; suggested next steps are optional.

## Scope

- Node 22+. The Git helpers require a committed repository; the agent can use its own file tools otherwise.
- Local context and targeted history collection each use a five-second budget with explicit path, revision and excerpt bounds.
- Memory and session access depend on the client's actual tools. No cross-client session bridge is installed.
- The helper does not run fixes, message agents or upload the repository. The agent's configured inference provider still governs its context. Common secret redaction is incomplete.

This is experimental. A small prior synthetic comparison did not establish better diagnosis than ordinary Codex.

## Development

Use Node 22+ and Bun 1.4.2:

```sh
bun install --frozen-lockfile
bun run verify
node scripts/install-smoke.mjs
```

CI checks lint, types, offline tests, generated-code parity, real installation, the package allowlist and the website build on Node 22 and 24. The release workflow supports candidate preparation and npm publication with provenance once its trusted-publisher binding is configured. See [Contributing](CONTRIBUTING.md), [Security](SECURITY.md) and [Releasing](RELEASING.md).

MIT licensed. For production fixes and prevention, [try Polylane](https://polylane.com/?utm_source=whodunit&utm_medium=readme).
