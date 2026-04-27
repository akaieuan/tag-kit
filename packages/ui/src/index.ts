/**
 * @tag-kit/ui — headless React components for tagging workflows.
 *
 * Two primitives:
 *   - <TagPicker /> : catalog browser with modality filter + search,
 *                     grouped by entry.group, fires onPick.
 *   - <TagChip />   : display + optional remove button for one tag.
 *
 * Both render zero styles by default — they emit semantic
 * `data-tag-kit-*` attributes the consumer styles with their own CSS.
 * Pass a `children` render-prop to either component to take full control
 * over the markup (drop into shadcn / Mantine / your own design system).
 *
 * Domain types come from `@tag-kit/core` — re-exported here for
 * convenience so consumers can import everything from one place.
 */

export { TagPicker, type TagPickerProps } from "./TagPicker.js";
export {
  TagChip,
  type TagChipProps,
  type TagChipRenderInfo,
} from "./TagChip.js";

export type {
  ReviewerTag,
  ExpectedTag,
  TagAgreement,
  TagScope,
  TagCatalogEntry,
} from "@tag-kit/core";
