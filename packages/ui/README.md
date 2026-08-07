# @tag-kit/ui

Headless React primitives for [tag-kit](https://github.com/akaieuan/tag-kit) — pickers, chips, summaries, and filters for human-in-the-loop annotation.

**Zero CSS shipped.** Style it with whatever you already use.

[![npm version](https://img.shields.io/npm/v/@tag-kit/ui)](https://www.npmjs.com/package/@tag-kit/ui)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/akaieuan/tag-kit/blob/main/LICENSE)

Requires React ≥18 and [`@tag-kit/core`](https://www.npmjs.com/package/@tag-kit/core).

## Install

```bash
npm install @tag-kit/core @tag-kit/ui
# or
pnpm add @tag-kit/core @tag-kit/ui
```

## What's in the box

| Export | What it does |
|---|---|
| `TagPicker` | Catalog browser — modality filter, free-text search over `tagId`/`displayName`/`description`, group bucketing. Disables already-staged tags. |
| `TagChip` | Renders one applied tag, with optional remove. Falls back to the raw `tagId` while the catalog is still loading. |
| `TagSummary` | Buckets applied tags by group, severity, or modality with counts. |
| `TagFilter` | Faceted filter UI over a catalog — severity, group, modality. |
| `useTagStaging` | Staging state for tags a reviewer has picked but not yet saved. |
| `useTagFilter` | Filters a tag list by modality, severity, group, or query. |

## Usage

```tsx check
import { useState } from "react";
import { TagPicker, TagChip, TagSummary, useTagStaging } from "@tag-kit/ui";
import { defineCatalog } from "@tag-kit/core";

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

export function TagEditor({ modality }: { modality: string }) {
  const staging = useTagStaging();

  return (
    <>
      <TagPicker
        catalog={CATALOG}
        staged={staging.staged}
        modality={modality}
        onPick={staging.stage}
      />
      {staging.staged.map((tag) => (
        <TagChip
          key={tag.tagId}
          tag={tag}
          entry={CATALOG.find((c) => c.tagId === tag.tagId)}
          state="staged"
          onRemove={() => staging.unstage(tag.tagId)}
        />
      ))}
      <TagSummary tags={staging.staged} catalog={CATALOG} groupBy="severity" />
    </>
  );
}

void useState;
```

## Styling

Every component renders semantic `data-tag-kit-*` attributes and nothing else — no classes, no inline styles, no design-system assumptions:

```css
[data-tag-kit-severity="danger"] { border-color: crimson; }
[data-tag-kit-state="staged"]    { opacity: 0.7; }
```

When attribute hooks aren't enough, pass a `children` render-prop to take over the markup entirely. `TagChip` and `TagFilter` hand you a render-info object (label, severity, state, facet toggles); `TagPicker` hands you the composed content so you can drop it into a popover, modal, or sheet.

## Status

**v0.3.0** — pre-1.0. Headless by policy: no default styles will be added, not even utility classes.

## Links

- [Project README](https://github.com/akaieuan/tag-kit#readme) — full pitch and architecture
- [`@tag-kit/core`](https://www.npmjs.com/package/@tag-kit/core) — the schema and scoring these render
- [akaOSS](https://www.akaoss.dev/projects/tag-kit) — the thesis this belongs to
- [Issues](https://github.com/akaieuan/tag-kit/issues)

## License

MIT
