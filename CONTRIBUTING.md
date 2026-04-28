# Contributing to tag-kit

Thanks for your interest. tag-kit is a small OSS project with a deliberately narrow scope — **structured tagging primitives for human-in-the-loop annotation**. Contributions that sharpen that core (more reusable schema, cleaner matching, better headless UI) are especially welcome. Contributions that broaden it into persistence, styling, or workflow are not.

## Dev setup

```bash
git clone https://github.com/akaieuan/tag-kit.git
cd tag-kit
pnpm install
pnpm -r build
pnpm -r test
```

You need Node 20+ and pnpm 10+. `.nvmrc` pins Node 20 for `nvm use`.

## Project layout

- `packages/core` — schema, catalog helpers, scope-overlap matching, tag-agreement scoring. **No runtime deps** — pure TypeScript + pure functions.
- `packages/ui` — headless React primitives (`TagPicker`, `TagChip`). Peer dep on React 18+ and `@tag-kit/core`. Zero CSS shipped.
- `examples/moderation` — reference 13-tag content moderation catalog. Source-only (no build step), demonstrates the recommended `<modality>.<category>` `tagId` convention.

## Before you open a PR

```bash
pnpm -r build
pnpm -r typecheck
pnpm -r test
```

All three should be clean. CI runs the same on Ubuntu + macOS, Node 20 + 22.

## Scope of contributions we want

- **New example catalogs.** Medical chart annotation, legal document review, code review, image moderation, transcript labeling. Each lives under `examples/<domain>/` as its own workspace package, source-only, demonstrating the catalog shape.
- **Additional matching modes** as opt-in extensions. Polygon ROI overlap, IoU thresholds, confidence-weighted matching. Don't change the conservative defaults.
- **Headless UI primitives** that compose with `TagPicker`/`TagChip`. A `TagSummary` that aggregates per-modality, a `TagFilter` for queue views, etc.
- **Docs fixes** — concrete examples, clearer matching-rule explanations, more `tagId` naming-convention guidance.

## Scope we don't want

- **Runtime deps in `@tag-kit/core`.** No Zod, no lodash, no ts-pattern. The core is a TypeScript-only set of shapes + pure functions. If validation gets hairy, hand-roll it (see `defineCatalog`).
- **CSS or design-system assumptions in `@tag-kit/ui`.** The components are headless on purpose. `data-tag-kit-*` attributes are the styling hook. Render-prop `children` is the markup-override hook. No defaults shipped.
- **Persistence.** tag-kit defines wire shapes; serialization is the consumer's job.
- **Workflow engines.** tag-kit doesn't decide who reviews what or when.

## Filing issues

Good issue title: `tagsMatch returns false when scope.span ranges abut at the boundary`. Bad: `matching is broken`.

Include:
- tag-kit version (from `packages/core/package.json` or `packages/ui/package.json`)
- Node version
- A minimal reproduction — usually a few-line TypeScript snippet that constructs the tags and shows the unexpected output

## A note on linting

tag-kit ships an ESLint + Prettier setup (see `eslint.config.js`, `.prettierrc.json`). PRs should run `pnpm -r lint` clean. Style is intentionally light-touch — recommended rules only, no opinionated stylistic enforcement.
