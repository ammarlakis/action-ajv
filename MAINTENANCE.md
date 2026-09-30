# Maintenance

Status: pilot; manual merge and release approval. Runtime: GitHub Actions Node 24.

## Verify a change

Run `npm ci`, `npm run build`, and `npm test`. Commit `dist/` with source and lockfile changes. `npm run check:bundle` detects stale bundles. Consumer tests copy the bundle outside the repository and run without installed dependencies. CI also invokes `uses: ./` and verifies runner outputs.

Require **Packaged action consumer tests** on `master` before merging. Weekly CI checks the default branch. Renovate opens weekly grouped minor/patch updates; majors remain separate and automerge is disabled.

The supported contract covers JSON/YAML data, globs, Ajv options, valid/error outputs, and nonzero exit on invalid data. An empty data glob retains the existing success behavior. `errors` is a flat JSON array of Ajv validation errors across failed files. Missing or malformed input sets `valid=false`.

## Release

Obtain maintainer approval. Prepare a PR updating `package.json` and its lockfile version, the bundle, and release notes. After the PR is merged and required checks pass, create an immutable `vX.Y.Z` tag on that commit. The release workflow reruns verification, checks the version and branch ancestry, publishes the exact source/bundle archive, and compares its downloaded bytes. GitHub generates the release changelog from merged changes.

Consumers should pin an immutable release tag or full commit SHA. Do not move an existing release tag. Node 24 raises the minimum runner requirement; mention this and the corrected validation/option behavior in release notes before publishing.

## Known coverage limits

JTD-specific Ajv options are exposed by the existing metadata but are not a separately verified JTD support promise. Hardware/OS-specific runners are outside this Linux pilot. A reviewed release and branch protection are still required before considering automatic dependency merging.
