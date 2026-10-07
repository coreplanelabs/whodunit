# Contributing

Use Node 22+ and Bun 1.4.2.

    bun install --frozen-lockfile
    bun run verify
    node scripts/install-smoke.mjs

Keep the investigation repository-independent. Improve evidence collection, supported causal reasoning, readability, or installation. A visual should explain a relationship; suggestions and fixes remain optional.

Unit tests use injected filesystem/process/time boundaries. Run real installation and browser checks separately. Preserve inconclusive results and diagnostic ties. Do not claim better diagnosis without a matched comparison.

The compiled files under skill/whodunit/scripts/lib are checked in so GitHub installs work without a build tool. Regenerate them with bun run build and include them in your pull request. CI rejects stale output.

For bugs, provide the client/version and a small synthetic reproduction. Leave private repository context, credentials and agent transcripts out of public issues. Security reports belong in GitHub's private vulnerability reporting channel.
