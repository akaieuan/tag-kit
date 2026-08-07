# @tag-kit/core

Schema, catalog, scope-aware matching, and agreement scoring for [tag-kit](https://github.com/akaieuan/tag-kit) — structured tagging primitives for human-in-the-loop annotation.

**Bring your own taxonomy. Bring your own UI. Bring your own scoring loop.**

[![npm version](https://img.shields.io/npm/v/@tag-kit/core)](https://www.npmjs.com/package/@tag-kit/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/akaieuan/tag-kit/blob/main/LICENSE)

Zero runtime dependencies. TypeScript strict, ESM-only, raw `tsc` output — no bundler.

## Install

```bash
npm install @tag-kit/core
# or
pnpm add @tag-kit/core
```

## What's in the box

- **Schema** — `TagScope`, `ReviewerTag`, `ExpectedTag`, `TagAgreement`. Plain TypeScript interfaces, no validation library. Serialize them however you like.
- **Catalog** — `defineCatalog` validates your vocabulary at startup (duplicate, empty, and malformed `tagId`s throw). `findEntry`, `filterByModality`, `groupByCategory` for the read paths.
- **Matching** — `tagsMatch` / `scopeOverlaps` implement conservative scope overlap. Deliberately cautious; see the table below.
- **Scoring** — `tagPrecisionRecall` computes per-tag precision/recall/F1 across many entities. `binaryAgreement` is the lightweight variant when you've already bucketed by tag.

## Usage

```ts check
import { defineCatalog, tagPrecisionRecall, type ReviewerTag } from "@tag-kit/core";

// 1. Define your domain's vocabulary once, at startup.
const CATALOG = defineCatalog([
  {
    tagId: "audio.harassment",
    displayName: "Audio harassment",
    description: "Spoken harassment, slurs, or threats.",
    applicableModalities: ["audio", "video"],
    severity: "danger",
    group: "Audio",
    supportsSegmentScope: true,
    supportsSpanScope: false,
  },
]);

// 2. Annotators apply tags with optional per-modality / per-segment scope.
const predicted: ReviewerTag[] = [
  {
    tagId: "audio.harassment",
    scope: { modality: "audio", segment: { start: 12, end: 24 } },
    note: "harasser identifies the target by name",
  },
];

// 3. Score predictions against gold tags.
const agreement = tagPrecisionRecall([
  {
    entityId: "event-1",
    expected: [
      { tagId: "audio.harassment", scope: { modality: "audio", segment: { start: 10, end: 30 } } },
    ],
    predicted,
  },
]);
// → [{ tagId: "audio.harassment", precision: 1, recall: 1, f1: 1, samples: 1, ... }]

void CATALOG;
void agreement;
```

## Matching rules

Two tags match when their `tagId`s are equal **and** their scopes overlap:

| Annotator A                | Annotator B                  | Match?                       |
| -------------------------- | ---------------------------- | ---------------------------- |
| `audio` segment `[10, 30]` | `audio` segment `[12, 24]`   | ✅ overlap                   |
| `audio` segment `[0, 10]`  | `audio` segment `[100, 110]` | ❌ disjoint                  |
| `audio` whole-track        | `audio` segment `[12, 24]`   | ✅ broader contains narrower |
| `video` whole-track        | `audio` segment `[12, 24]`   | ❌ different modality        |

Ranges are half-open intervals `[start, end)` — touching is not overlapping. Different `modality` or `assetId` never match. Each expected tag is consumed at most once, so one prediction can't satisfy two gold tags.

## Scoring notes

- Results are sorted alphabetically by `tagId` so dashboards render consistently across runs.
- `NaN` is replaced with `0` throughout, so the wire shape serializes cleanly.
- An optional `strategy` argument swaps in alternative matching rules; omit it and output is byte-for-byte identical to pre-strategy releases.

## Domain portability

`modality` is a free `string`, and `segment.start` / `segment.end` semantics (seconds, frames, samples, character offsets) are defined by you. The same primitives cover content moderation, medical chart annotation, legal document review, ML training-data labeling, and code review.

## Status

**v0.3.0** — pre-1.0. `tagId` is a stable foreign key: once shipped in a catalog it should never be renamed.

## Links

- [Project README](https://github.com/akaieuan/tag-kit#readme) — full pitch and architecture
- [`@tag-kit/ui`](https://www.npmjs.com/package/@tag-kit/ui) — headless React primitives built on these shapes
- [akaOSS](https://www.akaoss.dev/projects/tag-kit) — the thesis this belongs to
- [Issues](https://github.com/akaieuan/tag-kit/issues)

## License

MIT
