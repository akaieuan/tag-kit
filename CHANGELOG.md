# Changelog

All notable changes to tag-kit are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
