# Changelog

All notable changes to tag-kit are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] — 2026-05-08

Developer-experience expansion. Four additive feature buckets — no breaking changes. Default behavior of every existing API (`defineCatalog`, `tagsMatch`, `tagPrecisionRecall`, `<TagPicker />`, `<TagChip />`) is byte-for-byte equivalent to 0.2.x when called without the new options.

### Added — `@tag-kit/core`

**Catalog construction ergonomics:**

- `tag(tagId)` — chainable builder with sensible defaults (`severity: "neutral"`, `group: "Default"`, both scope flags `false`). Cuts ~5 lines per entry. Validates via `defineCatalog` on `.build()`.
- `mergeCatalogs(...catalogs)` — combines multiple catalogs and validates the merged result. Catches `DUPLICATE_TAG_ID` across catalogs at boot time.
- `defineNamespacedCatalog(modalities, entries)` — type-safe namespacing. Constrains every `tagId` to `\`${TModality}.${string}\``at compile time. Pure type-level — runtime parity with`defineCatalog`.
- New subpath export: `@tag-kit/core/builder`.

**Pluggable matching strategies:**

- `MatchStrategy` interface — pure boolean predicate over `(a, b)` tag-like values.
- Four shipped strategies:
  - `strictMatch` — half-open intervals (the 0.1/0.2 default).
  - `looseMatch` — closed intervals; touching ranges count as overlap.
  - `fuzzyMatch({ distance })` — Levenshtein-tolerant `tagId` + strict scope. Default distance 1.
  - `confidentMatch({ minConfidence })` — pure confidence filter (`low` < `medium` < `high`). Compose with strict/loose/fuzzy via `combineStrategies`.
- `combineStrategies(...strategies)` — match iff ALL agree.
- `tagsMatchWith(a, b, strategy?)` — strategy-aware matcher convenience.
- `tagPrecisionRecall(entities, strategy?)` — accepts a strategy. Without it, output is byte-for-byte equivalent to 0.2.x.
- New subpath export: `@tag-kit/core/strategies`.
- Hand-rolled Levenshtein (two-row DP, `O(min(m,n))` space) — no new dependencies.

**Validation extensibility:**

- `defineCatalog(entries, options)` — new optional second argument:
  - `rules` — additional `CustomCatalogRule[]` checks beyond the six built-ins.
  - `severity` — `"strict"` (default, throws on errors) or `"warn"` (never throws, emits `console.warn` per finding).
- `validateCatalog(entries, options?)` — returns `{ ok, errors, warnings, all }` instead of throwing. For consumers loading catalogs from runtime config (YAML/JSON).
- Custom rules can return `null` (pass), a `string` (fail with default severity), or `{ message, severity }` (explicit severity).
- Exported types: `CatalogValidationError`, `CatalogValidationCode` (open string union), `BuiltInCatalogValidationCode`, `CustomCatalogRule`, `DefineCatalogOptions`, `ValidateCatalogResult`.

### Added — `@tag-kit/ui`

**Hooks:**

- `useTagStaging({ initial?, onChange? })` — manages the staged-tag state most consumers roll themselves around `<TagPicker />`. Returns `{ staged, stage, unstage, setStaged, clear, has }`. `stage()` is no-op for already-staged `tagId`s; `onChange` fires only on real state changes.
- `useTagFilter(tags, options, catalog?)` — pure filter helper. Narrows `ReviewerTag[]` by modality / severity / group / free-text query. Query matches against `tagId`, `displayName`, `description`, and `note`.

**Components:**

- `<TagSummary />` — counts per `tagId` / `modality` / `severity` / `group`. Alphabetical bucket order.
- `<TagFilter />` — toggle-style filter UI driven by catalog facets. Controlled `{ value, onChange }`. Pairs with `useTagFilter`.

**TagPicker keyboard navigation (opt-in):**

- New `keyboard` prop. When `true`: `ArrowDown`/`ArrowUp` move highlight (skipping disabled), `Enter` fires `onPick`, `Escape` clears the search query. Highlighted entry exposes `data-tag-kit-highlighted="true"` for styling. Off by default.

### Internal

- Tests: 61 → 143 (+82 new). 79 core, 64 UI. All matrix cells green.
- No new runtime dependencies in either published package.

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
