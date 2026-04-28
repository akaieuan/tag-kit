import { useMemo, useState, type ReactNode } from "react";
import {
  filterByModality,
  groupByCategory,
  type ReviewerTag,
  type TagCatalogEntry,
} from "@tag-kit/core";

export interface TagPickerProps {
  /** The catalog to browse. Filtered by modality before display. */
  catalog: readonly TagCatalogEntry[];
  /** Currently-staged tags — entries already chosen are disabled in the picker. */
  staged: readonly { tagId: string }[];
  /** Modality the picker should narrow to. Pass null to show every tag. */
  modality: string | null;
  /** Fired when the user picks a tag from the catalog. */
  onPick: (tag: ReviewerTag) => void;
  /** Optional initial query — useful for tests + deep-linking. */
  initialQuery?: string;
  /** Render slot — wrap the picker content in your own popover / sheet / modal.
   *  Defaults to a plain `<div>` so the picker works headless. */
  children?: (content: ReactNode) => ReactNode;
}

/**
 * Headless tag picker. Filters the catalog by modality + free-text query,
 * groups by `entry.group`, and fires `onPick` when an entry is selected.
 *
 * The component renders zero styles by default — wrap it in your own
 * popover / sheet / dropdown and style the markup with whatever your app
 * uses (Tailwind, CSS modules, vanilla CSS). The data shape is what's
 * stable; the markup is intentionally generic.
 */
export function TagPicker({
  catalog,
  staged,
  modality,
  onPick,
  initialQuery = "",
  children,
}: TagPickerProps) {
  const [query, setQuery] = useState(initialQuery);

  const stagedIds = useMemo(() => new Set(staged.map((t) => t.tagId)), [staged]);

  const visible = useMemo(() => {
    const byModality = modality === null ? catalog.slice() : filterByModality(catalog, modality);
    const q = query.trim().toLowerCase();
    if (q.length === 0) return byModality;
    return byModality.filter(
      (e) =>
        e.tagId.toLowerCase().includes(q) ||
        e.displayName.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    );
  }, [catalog, modality, query]);

  const grouped = useMemo(() => {
    const buckets = groupByCategory(visible);
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const content = (
    <div data-tag-kit="picker">
      <div data-tag-kit="picker-search">
        <input
          aria-label="Search tags"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search tags…"
        />
      </div>
      {grouped.length === 0 ? (
        <div data-tag-kit="picker-empty">no matching tags</div>
      ) : (
        grouped.map(([group, entries]) => (
          <div key={group} data-tag-kit="picker-group">
            <div data-tag-kit="picker-group-label">{group}</div>
            <ul data-tag-kit="picker-list">
              {entries.map((entry) => {
                const isStaged = stagedIds.has(entry.tagId);
                return (
                  <li key={entry.tagId} data-tag-kit="picker-item">
                    <button
                      type="button"
                      disabled={isStaged}
                      data-tag-kit-severity={entry.severity}
                      onClick={() => onPick({ tagId: entry.tagId })}
                    >
                      <span data-tag-kit="picker-item-label">{entry.displayName}</span>
                      <span data-tag-kit="picker-item-description">{entry.description}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );

  return children ? <>{children(content)}</> : content;
}
