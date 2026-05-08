/**
 * @tag-kit/ui — headless React components and hooks for tagging workflows.
 *
 * Components:
 *   - <TagPicker />  : catalog browser with modality filter + search,
 *                      grouped by entry.group, fires onPick. Optional
 *                      arrow-key navigation via `keyboard` prop.
 *   - <TagChip />    : display + optional remove button for one tag.
 *   - <TagSummary /> : counts per tagId / modality / severity / group.
 *   - <TagFilter />  : toggle-style filter UI driven by catalog facets.
 *
 * Hooks:
 *   - useTagStaging  : manages staged-tag React state with stage/unstage/has.
 *   - useTagFilter   : pure filter helper for ReviewerTag arrays.
 *
 * All components render zero styles by default — they emit semantic
 * `data-tag-kit-*` attributes the consumer styles with their own CSS.
 * Pass a `children` render-prop to take full control over the markup
 * (drop into shadcn / Mantine / your own design system).
 *
 * Domain types come from `@tag-kit/core` — re-exported here for
 * convenience so consumers can import everything from one place.
 */

export { TagPicker, type TagPickerProps } from "./TagPicker.js";
export { TagChip, type TagChipProps, type TagChipRenderInfo } from "./TagChip.js";
export {
  TagSummary,
  type TagSummaryProps,
  type TagSummaryGroupBy,
  type TagSummaryEntry,
  type TagSummaryRenderInfo,
} from "./TagSummary.js";
export {
  TagFilter,
  type TagFilterProps,
  type TagFilterValue,
  type TagFilterFacet,
  type TagFilterFacetOption,
  type TagFilterRenderInfo,
} from "./TagFilter.js";

export {
  useTagStaging,
  type UseTagStagingOptions,
  type UseTagStagingReturn,
} from "./useTagStaging.js";
export { useTagFilter, type UseTagFilterOptions } from "./useTagFilter.js";

export type {
  ReviewerTag,
  ExpectedTag,
  TagAgreement,
  TagScope,
  TagCatalogEntry,
} from "@tag-kit/core";
