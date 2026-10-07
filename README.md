# Whodunit

**Find the change behind the failure.**

Whodunit is a debugging skill for coding agents. It connects a problem to local code, relevant changes and available agent history, then explains the supported cause with evidence.

## Install

Run from any directory:

```sh
npx @coreplane/whodunit
```

The installer registers Whodunit in your user skill folders for Codex, Claude Code and OpenCode, across all your projects. Restart your coding agent after installing. It preserves edited or unrelated skill files and leaves project dependencies alone.

To target one client, add `--agent codex`, `--agent claude`, or `--agent opencode`. For a project-only install, use `--root /path/to/project`. `--home /path/to/home` selects a different user profile.

## Use

Ask your agent what went wrong, or invoke the skill directly:

```text
/whodunit Investigate why login stopped working.
```

Claude Code uses `/whodunit`; Codex supports `$whodunit`. In any supported client, you can ask: “Use Whodunit to investigate why login stopped working.” Give the actual symptom or error. You do not need to tell the agent to read a skill-file path.

Supported visual clients get a concise report with selectable graph nodes and sources. Codex's inline helper saves the report in the current chat's allowed visualization folder. Terminals get a short summary plus a saved local browser report. Context and change-history evidence stay in the same report. A short suggested fix appears above the controls. In Codex, **Fix it** sends a request to your agent. Saved browser reports have no fix controls. The terminal asks whether you want a fix.

## Auto-fix

Whodunit asks before fixing by default. To save a choice for future uses:

```sh
npx @coreplane/whodunit settings auto-fix on
npx @coreplane/whodunit settings auto-fix off
npx @coreplane/whodunit settings show
```

The choice is stored in `~/.coreplanelabs/whodunit/settings.json`. The report helper reads it. The skill asks your agent to read it before editing. Auto-fix asks the agent to try local code changes and relevant tests when the cause is supported. The agent may need more evidence or permission. “Report only” stops edits for the current use. Publishing, deployment, credentials, other agents and existing approval gates keep their normal boundaries.

## Website

The website at [whodunit.dev](https://whodunit.dev) uses the same report renderer. Its example includes a suggested fix, sources, and an interactive graph. The example's fix buttons link to Polylane. In your coding agent, the buttons send requests to that agent.

The static site runs in Polycorp's Cloudflare account. To deploy, sign in to that account with Wrangler and run `npm run deploy:site`. The command builds and checks the site before deploying. The custom domain serves the site publicly; it does not use Cloudflare Access.

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
node scripts/npx-smoke.mjs
```

CI checks lint, types, offline tests, generated-code parity, real installation, the package allowlist and the website build on Node 22 and 24. The release workflow supports candidate preparation and npm publication with provenance once its trusted-publisher binding is configured. See [Contributing](CONTRIBUTING.md), [Security](SECURITY.md) and [Releasing](RELEASING.md).

MIT licensed. For production fixes and prevention, [try Polylane](https://polylane.com/?utm_source=whodunit&utm_medium=readme).
