# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`tag-kit` is an open-source set of **structured tagging primitives for human-in-the-loop annotation workflows**. Per-modality scoping, scope-aware agreement scoring, framework-agnostic schema, headless React primitives. Bring your own taxonomy, bring your own UI styling, bring your own scoring loop — `tag-kit` ships the substrate.

`README.md` is the public pitch + quickstart, not the spec. The substance lives in:

- `packages/core/src/schema.ts` — wire shapes (`TagScope`, `ReviewerTag`, `ExpectedTag`, `TagAgreement`)
- `packages/core/src/matching.ts` — the conservative scope-overlap rules (load-bearing — see "Conventions")
- `packages/core/src/scoring.ts` — `tagPrecisionRecall` aggregation rules
- `README.md` §"Conventions" + §"What tag-kit is NOT" — guardrails to push back on out-of-scope suggestions

The project was extracted from [`inertial`](https://github.com/akaieuan/inertial-moderation-tool) (a real moderation app) — when in doubt about whether an API change is worth it, ask "does this still work for medical chart annotation, legal review, and ML training data labeling?"

## Commands

pnpm workspaces; Node ≥20 (`.nvmrc` pins 20). Run from repo root unless noted.

- `pnpm install` — install workspace deps
- `pnpm -r build` — `tsc` build per package (no bundler)
- `pnpm -r dev` — parallel `tsc --watch` across packages
- `pnpm -r test` — `vitest run` across packages
- `pnpm -r typecheck` — `tsc --noEmit` across packages
- `pnpm -r lint` — `eslint src test` per package
- `pnpm format` — `prettier --write .`
- `pnpm -r clean` — remove `dist/`, `*.tsbuildinfo`

Scoped to one package: `pnpm --filter @tag-kit/core <script>`. Single test file: `pnpm --filter @tag-kit/core exec vitest run path/to/file.test.ts`.

**CI ordering matters:** `pnpm -r build` must run before `pnpm -r typecheck` because `examples/moderation` resolves `@tag-kit/core` via the package's `types: ./dist/index.d.ts` field. Without `dist/`, typecheck fails with `TS2307: Cannot find module '@tag-kit/core'`.

## Architecture

Monorepo layout:

```
tag-kit/
├── packages/
│   ├── core/        @tag-kit/core      schema + catalog + scoring + matching
│   └── ui/          @tag-kit/ui        TagPicker + TagChip (headless React)
└── examples/
    └── moderation/  @tag-kit/example-moderation   13-tag content moderation catalog
```

### `@tag-kit/core` (TypeScript, ESM, `tsc` only — no bundler)

- `src/schema.ts` — wire shapes only, no logic. `TagScope { modality?, assetId?, segment?, span? }`, `ReviewerTag { tagId, scope?, note? }`, `ExpectedTag { tagId, scope?, confidence? }`, `TagAgreement { tagId, truePositives, falsePositives, falseNegatives, precision, recall, f1, samples }`.
- `src/catalog.ts` — `defineCatalog` (validates entries; throws on duplicate/empty/invalid `tagId`s), `findEntry`, `filterByModality` (entries with empty `applicableModalities` are universal), `groupByCategory`.
- `src/matching.ts` — `scopeOverlaps` and `tagsMatch`. Conservative rules: both undefined → match; one undefined → broader-contains-narrower; different `modality` or `assetId` → never match; ranges use half-open intervals `[start, end)`.
- `src/scoring.ts` — `tagPrecisionRecall` (per-tag P/R/F1 across entities; each expected tag is consumed at most once to prevent double-counting; results sorted alphabetically; NaN replaced with 0), `binaryAgreement` (lightweight aggregator for pre-bucketed boolean samples).

### `@tag-kit/ui` (TypeScript + React, `tsc` only, JSX)

- `src/TagPicker.tsx` — catalog browser with modality filter + free-text search (over `tagId`/`displayName`/`description`) + group bucketing. Disables already-staged tags. Renders zero styles; emits `data-tag-kit-*` attributes. `children` render-prop wraps content for popover/modal/sheet integration.
- `src/TagChip.tsx` — display + optional remove. Falls back to raw `tagId` if `entry` is undefined (during catalog loading). `data-tag-kit-severity`, `data-tag-kit-state` attributes. `children` render-prop receives a `TagChipRenderInfo` and replaces default markup.
- Both components are **headless** — no CSS, no design-system assumption.

### `examples/moderation`

Source-only (no build), demonstrates the recommended `<modality>.<category>` `tagId` convention. 13 tags spanning text/image/video/audio/cross-modal scopes. Doesn't publish to npm (`private: true`).

## Project-specific conventions

- **ESM only.** All imports use explicit `.js` extensions in TypeScript source (e.g. `from "./schema.js"`). Required by `verbatimModuleSyntax: true` + `moduleResolution: "Bundler"` in `tsconfig.base.json`. Keep this when adding files.
- **`noUncheckedIndexedAccess` is on** (`tsconfig.base.json`). Indexing a map/array yields `T | undefined`. The non-null `!` assertion in `groupByCategory` (after a `set` to the same key) is the canonical pattern; otherwise prefer `?? defaultValue` or narrowing.
- **`@tag-kit/core` has zero runtime deps.** Never add Zod, ts-pattern, lodash, anything. The core is a TypeScript-only set of shapes + pure functions. If validation gets hairy, hand-roll it — see `defineCatalog`'s validation block in `catalog.ts`.
- **Stable `tagId`s.** Once shipped in any catalog, a `tagId` should never be renamed — it's the FK from persisted `ReviewerTag` rows to your catalog. The `scope check` checklist in the PR template enforces this.
- **Headless UI.** Zero CSS. No design-system primitives. The `data-tag-kit-*` attributes are the styling hook; the `children` render-prop is the markup-override hook. Don't add default styles, even via Tailwind classes.
- **Conservative matching.** `scopeOverlaps` is intentionally cautious — different modality never matches, different `assetId` never matches, ranges must overlap (not just touch — half-open intervals `[start, end)`). New matching modes go behind opt-in extensions, not by relaxing defaults.

## What this project is NOT

These guardrails should push back on out-of-scope suggestions:

- **Not a persistence layer.** Bring your own DB. Schema is plain TypeScript interfaces; serialize however you want.
- **Not an active-learning loop.** It scores tag agreement; it doesn't pick which entities to review next.
- **Not a workflow engine.** It assumes someone else (your app) decides who reviews what.
- **Not a styled UI library.** Headless React only. Style with what you have — Tailwind, CSS modules, design-system primitives, inline styles, whatever.

## Sibling projects

- [`inertial`](https://github.com/akaieuan/inertial-moderation-tool) — the moderation app `tag-kit` was extracted from. Real working consumer; treat as the integration test.
- [`eval-kit`](https://github.com/akaieuan/eval-kit) — sibling project with the same authoring style. Different domain (agent evaluation, not tagging). Match its tooling patterns when ours fall short.
- [`HITL-KIT`](https://github.com/akaieuan/HITL-KIT) — human-in-the-loop UI primitives (queues, traces, decisions). Pairs with `tag-kit` when you want a full review workflow.
