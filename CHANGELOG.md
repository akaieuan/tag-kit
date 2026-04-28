# Changelog

All notable changes to tag-kit are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] — 2026-04-28

### Changed (breaking)

- `defineCatalog()` now **validates entries and throws** on invalid input. Previously it was a passthrough that returned its input unchanged. Catalogs that boot fine on `0.1.x` will throw on `0.2.0` if they contain any of:
  - `EMPTY_TAG_ID` — a `tagId` that is empty or whitespace-only
  - `DUPLICATE_TAG_ID` — two entries sharing the same `tagId`
  - `INVALID_TAG_ID_CHARS` — a `tagId` containing characters outside `[a-zA-Z0-9._:-]` (whitespace, slashes, control chars, etc.)
  - `EMPTY_DISPLAY_NAME` / `EMPTY_DESCRIPTION` / `EMPTY_GROUP` — required string fields that are empty or whitespace-only

  All errors are aggregated into a single thrown `Error`; the message lists each violation with its `[index N]` and the offending `tagId`. The reference catalog `@tag-kit/example-moderation` is unaffected — all 13 entries pass.

  **Migration:** before upgrading, audit your catalog. If you load catalogs from a config file at runtime, wrap the `defineCatalog` call in a `try/catch` and surface the message to the user. Hand-rolled validation — no Zod or other runtime-validation lib added to `@tag-kit/core`'s dep tree.

### Internal

- `@tag-kit/ui` bumps to `0.2.0` to stay version-aligned with `@tag-kit/core`. No public-API changes in `@tag-kit/ui`.

## [0.1.0] — 2026-04-27

Initial scaffold of `tag-kit`. Two published packages and one source-only example.

### Added

- `@tag-kit/core` — schema, catalog helpers, scope-overlap matching, and tag-agreement scoring.
  - `schema.ts` — wire shapes: `TagScope`, `ReviewerTag`, `ExpectedTag`, `TagAgreement`.
  - `catalog.ts` — `defineCatalog`, `findEntry`, `filterByModality`, `groupByCategory`.
  - `matching.ts` — `scopeOverlaps` (conservative-overlap rules), `tagsMatch`.
  - `scoring.ts` — `tagPrecisionRecall` (per-tag P/R/F1 across entities), `binaryAgreement` (pre-bucketed variant).
- `@tag-kit/ui` — headless React primitives.
  - `TagPicker` — modality-filtered, search-filtered, group-bucketed catalog browser.
  - `TagChip` — display + optional remove. Render-prop fallback for design-system integration.
  - Both emit `data-tag-kit-*` attributes; zero CSS shipped.
- `@tag-kit/example-moderation` — 13-tag content moderation catalog covering text, image, video, audio, and cross-modal scopes.

### Internal

- pnpm workspaces (Node ≥20, pnpm 10+), TypeScript strict + `noUncheckedIndexedAccess`, ESM-only with `verbatimModuleSyntax`.
- `tsc`-only builds — no bundler. Packages publish raw `dist/`.
- Vitest tests on `@tag-kit/core` covering catalog helpers, scope-matching rules, and scoring (28 tests, all passing).
- GitHub Actions CI on every push/PR to `main`.
