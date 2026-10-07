# Releasing

CI checks lint, types, builds, offline tests, generated-file parity, installation and the npm allowlist on Node 22 and 24.

1. Update package.json, rebuild, run bun run verify, and commit generated files.
2. Create a tag matching the package version, such as v0.1.0.
3. Publish its GitHub release. release.yml verifies that exact tag and publishes the checked tarball with npm provenance.

The workflow's Prepare only dispatch builds and uploads a candidate without publishing.

The first npm publication requires maintainer sign-in and npm 2FA. The package must exist before trusted publishing can be configured. Bind its publisher to GitHub organization coreplanelabs, repository whodunit, workflow release.yml, with permission to publish this package.

Do not store a long-lived npm token in GitHub. [npm's trusted publishing guide](https://docs.npmjs.com/trusted-publishers/) describes the OIDC setup. Until that binding exists, the workflow is prepared but cannot publish. A green build is not a publication receipt.
