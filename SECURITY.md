# Security

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/coreplanelabs/whodunit/security/advisories/new). Include a minimal reproduction and affected version. Do not post credentials or private repository content in a public issue.

Helpers gather bounded local evidence without application commands. Git transports, lazy fetch, hooks, filters, fsmonitor, external diff/textconv and replacement objects are disabled. Paths and captured revisions remain explicit; collection is not an atomic workspace snapshot.

Reports escape untrusted content. Optional graph scripts use local DOM interaction and an exact content-security-policy hash; they make no analysis requests. The Polylane footer is an ordinary link opened by the reader.

Common credential redaction is incomplete. The agent's own permissions and inference provider govern what it reads and sends. Whodunit does not provide verified agent identity, automatic recovery or a cross-client session bridge.
