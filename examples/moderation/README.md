# Example: content moderation tag catalog

Drop-in catalog for a moderation pipeline. This is what
[`inertial`](https://github.com/akaieuan/inertial-moderation-tool) (the
reference moderation app `tag-kit` was extracted from) ships as its
`TAG_CATALOG`.

## Use it

```ts
import { TagPicker } from "@tag-kit/ui";
import { MODERATION_TAG_CATALOG } from "@tag-kit/example-moderation";

<TagPicker
  catalog={MODERATION_TAG_CATALOG}
  modality={event.primaryModality}
  staged={stagedTags}
  onPick={handlePick}
/>
```

## What it covers

- Text — `tone-violation`, `pii-present`, `coded-language`
- Image — `benign`, `violence`, `minor-present`
- Video — `visual-benign`, `visual-violation`, `audio-violation` (segment-scoped)
- Audio — `harassment`, `coded-speech` (segment-scoped, applies to standalone audio + video)
- Cross-modal — `text-image-mismatch`, `satire-flag` (whole-event)

13 tags spanning the modalities a federated or centralized moderation
service typically encounters. Extend by appending entries (the catalog is
plain data with stable `tagId`s).

## Naming convention

`<modality>.<category>` — modality narrows the picker, category is
short kebab-case. `cross-modal.*` tags have empty
`applicableModalities`, which `@tag-kit/core/filterByModality` treats as
universal (matches every modality).
