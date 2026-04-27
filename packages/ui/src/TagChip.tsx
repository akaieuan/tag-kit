import type { ReactNode } from "react";
import type { ReviewerTag, TagCatalogEntry } from "@tag-kit/core";

export interface TagChipProps {
  /** The tag to render. */
  tag: ReviewerTag;
  /** Catalog entry for the tag's `tagId`. When undefined, falls back to
   *  rendering the raw `tagId` — useful when the catalog is loading. */
  entry?: TagCatalogEntry;
  /** Optional state hint — `saved` tags came from persistence; `staged`
   *  tags are pending commit. Surfaces in the chip's data attribute. */
  state?: "saved" | "staged";
  /** When provided, the chip renders a remove button that fires this
   *  callback. Omit to render a read-only chip. */
  onRemove?: () => void;
  /** Replace the default markup. Useful when you want to render the chip
   *  inside your design-system primitives. */
  children?: (info: TagChipRenderInfo) => ReactNode;
}

export interface TagChipRenderInfo {
  label: string;
  severity: TagCatalogEntry["severity"] | "neutral";
  state: "saved" | "staged" | undefined;
  note: string | undefined;
  onRemove: (() => void) | undefined;
  /** Tooltip-friendly long form: `tagId — note`. */
  title: string;
}

/**
 * Headless tag chip. Renders zero styles by default — emits semantic
 * `data-tag-kit-*` attributes the consumer styles with their own CSS.
 *
 * Pass a `children` render-prop to take full control over the markup
 * (drop the chip into your design-system Badge / Tag primitive).
 */
export function TagChip({
  tag,
  entry,
  state,
  onRemove,
  children,
}: TagChipProps) {
  const label = entry?.displayName ?? tag.tagId;
  const severity = entry?.severity ?? "neutral";
  const title = tag.note ? `${tag.tagId} — ${tag.note}` : tag.tagId;
  const info: TagChipRenderInfo = {
    label,
    severity,
    state,
    note: tag.note,
    onRemove,
    title,
  };

  if (children) return <>{children(info)}</>;

  return (
    <span
      data-tag-kit="chip"
      data-tag-kit-severity={severity}
      data-tag-kit-state={state}
      title={title}
    >
      <span data-tag-kit="chip-label">{label}</span>
      {state && (
        <span data-tag-kit="chip-state">{state}</span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove tag ${label}`}
          onClick={onRemove}
          data-tag-kit="chip-remove"
        >
          ×
        </button>
      )}
    </span>
  );
}
