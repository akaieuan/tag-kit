# tag-kit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](#)
[![pnpm](https://img.shields.io/badge/pnpm-10-orange.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](#)

**Structured tagging primitives for human-in-the-loop annotation workflows.** Per-modality scoping, scope-aware agreement scoring, framework-agnostic schema. Bring your own taxonomy, bring your own UI, bring your own scoring loop — `tag-kit` ships the substrate.

```bash
pnpm add @tag-kit/core @tag-kit/ui
```

---

## Why this exists

Most "tagging" features in HITL tools are unstructured strings — you type a label, it gets stored next to the decision, and then nobody can aggregate or score across them later. That's fine for one-off review but useless once you want:

- **Per-modality scoping** — annotators say "the audio at 0:12-0:24 is harassment; the video is fine" instead of one whole-asset verdict
- **Scope-aware agreement** — when two reviewers tag overlapping segments with the same label, that's agreement; when they tag disjoint ones, it isn't
- **Stable taxonomy** — tag IDs that survive UI rewrites and feed precision/recall scoring
- **Domain portability** — the same primitives work for content moderation, medical chart annotation, legal document review, ML training data labeling, code review

`tag-kit` is what falls out when you take the tag layer out of a real moderation app ([`inertial`](https://github.com/akaieuan/inertial-moderation-tool)) and ask "what's the smallest reusable shape for this?"

## Two packages

### `@tag-kit/core` — schema + scoring + matching

```ts
import {
  defineCatalog,
  filterByModality,
  tagPrecisionRecall,
  tagsMatch,
  type ReviewerTag,
  type ExpectedTag,
} from "@tag-kit/core";

// 1. Define your domain's vocabulary.
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
  // ... your other tags
]);

// 2. Annotators apply tags with optional per-modality / per-segment scope.
const reviewerTags: ReviewerTag[] = [
  {
    tagId: "audio.harassment",
    scope: { modality: "audio", segment: { start: 12, end: 24 } },
    note: "harasser identifies the target by name",
  },
];

// 3. Score agreement between expected (gold) tags and predicted ones.
const agreement = tagPrecisionRecall([
  {
    entityId: "event-1",
    expected: [
      { tagId: "audio.harassment", scope: { modality: "audio", segment: { start: 10, end: 30 } } },
    ],
    predicted: reviewerTags,
  },
]);
// → [{ tagId: "audio.harassment", precision: 1, recall: 1, f1: 1, samples: 1, ... }]
```

The matching engine does **scope-aware overlap**:

| Annotator A                | Annotator B                  | Match?                       |
| -------------------------- | ---------------------------- | ---------------------------- |
| `audio` segment `[10, 30]` | `audio` segment `[12, 24]`   | ✅ overlap                   |
| `audio` segment `[0, 10]`  | `audio` segment `[100, 110]` | ❌ disjoint                  |
| `audio` whole-track        | `audio` segment `[12, 24]`   | ✅ broader contains narrower |
| `video` whole-track        | `audio` segment `[12, 24]`   | ❌ different modality        |

### `@tag-kit/ui` — headless React primitives

```tsx
import { TagPicker, TagChip } from "@tag-kit/ui";

<TagPicker
  catalog={CATALOG}
  staged={stagedTags}
  modality={event.primaryModality}
  onPick={handlePick}
/>;

{
  stagedTags.map((tag) => (
    <TagChip
      key={tag.tagId}
      tag={tag}
      entry={CATALOG.find((c) => c.tagId === tag.tagId)}
      state="staged"
      onRemove={() => unstage(tag.tagId)}
    />
  ));
}
```

Both components emit semantic `data-tag-kit-*` attributes. **Zero CSS shipped** — bring your own styles via Tailwind, CSS modules, or inline. Pass a `children` render-prop to either component to take full control of the markup (drop into your design-system primitives).

## Repo layout

```
tag-kit/
├── packages/
│   ├── core/        @tag-kit/core      schema + catalog + scoring + matching
│   └── ui/          @tag-kit/ui        TagPicker + TagChip (headless React)
└── examples/
    └── moderation/  @tag-kit/example-moderation   13-tag content moderation catalog
```

## Conventions

- **TypeScript strict + ESM-only.** `noUncheckedIndexedAccess` on. No bundler — packages publish raw `tsc` output.
- **Domain-agnostic by design.** `modality` is a free `string`. `segment.start/end` semantics (seconds vs frames vs samples) are defined by the consumer. The same primitives work for audio, video, text, document, and code annotation.
- **Stable tagIds.** Once shipped, `tagId` should never change — it's the FK from persisted `ReviewerTag` rows to your catalog.
- **Conservative matching.** Two tags match when their `tagId`s are equal AND their scopes overlap. Different modalities never match. Different `assetId`s never match. Broader scopes contain narrower ones (whole-modality contains specific segment).

## What `tag-kit` is NOT

- **Not a persistence layer.** Bring your own DB. The schema is plain TypeScript interfaces; serialize however you want.
- **Not an active-learning loop.** It scores tag agreement; it doesn't pick which entities to review next.
- **Not a workflow engine.** It assumes someone else (your app) decides who reviews what.
- **Not a styled UI library.** Headless React only. Style with what you have.

## Sibling projects

- [`inertial`](https://github.com/akaieuan/inertial-moderation-tool) — the open-source AI content moderation toolkit `tag-kit` was extracted from. Real working consumer.
- [`eval-kit`](https://github.com/akaieuan/eval-kit) — evaluation framework for collaborative-task agents. Different problem domain; same authoring style.
- [`HITL-KIT`](https://github.com/akaieuan/HITL-KIT) — human-in-the-loop UI primitives (queues, traces, decisions). Pairs naturally with `tag-kit` when you want a full review workflow.

## License

MIT — see [LICENSE](LICENSE).

Copyright © 2026 Ieuan King.
