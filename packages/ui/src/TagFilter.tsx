import { useMemo, type ReactNode } from "react";
import type { TagCatalogEntry } from "@tag-kit/core";

export interface TagFilterValue {
  /** Active severity allowlist. Empty = all severities. */
  severity?: readonly TagCatalogEntry["severity"][];
  /** Active group allowlist. Empty = all groups. */
  group?: readonly string[];
  /** Active modality allowlist. Empty = all modalities. */
  modality?: readonly string[];
}

export type TagFilterFacet = "severity" | "group" | "modality";

export interface TagFilterFacetOption {
  facet: TagFilterFacet;
  /** The bucket value (e.g. "danger", "Toxicity", "audio"). */
  value: string;
  /** True iff this option is currently in the active allowlist. */
  active: boolean;
  /** Number of catalog entries that fall under this option (helps the
   *  consumer's UI show counts next to checkboxes). */
  count: number;
  /** Toggle this option on/off and emit a new TagFilterValue. */
  toggle: () => void;
}

export interface TagFilterRenderInfo {
  options: readonly TagFilterFacetOption[];
  /** Convenience: clear every facet to "show all". */
  clear: () => void;
  value: TagFilterValue;
}

export interface TagFilterProps {
  /** Catalog whose facet values populate the filter options. */
  catalog: readonly TagCatalogEntry[];
  /** Current filter state (controlled). */
  value: TagFilterValue;
  /** Fired when the user toggles an option. */
  onChange: (next: TagFilterValue) => void;
  /** Which facets to surface. Defaults to all three. */
  facets?: readonly TagFilterFacet[];
  /** Replace the default markup. */
  children?: (info: TagFilterRenderInfo) => ReactNode;
}

/**
 * Headless toggle-style filter UI. Surfaces the unique severity / group /
 * modality values from the catalog and lets the user toggle them on/off.
 * Renders zero styles by default — `data-tag-kit-*` attributes are the
 * styling hook.
 *
 *     const [filter, setFilter] = useState<TagFilterValue>({});
 *     <TagFilter catalog={CATALOG} value={filter} onChange={setFilter} />
 *
 * Pair with `useTagFilter(staged, filter, catalog)` to filter the
 * displayed tag list.
 */
export function TagFilter({
  catalog,
  value,
  onChange,
  facets = ["severity", "group", "modality"],
  children,
}: TagFilterProps) {
  const info = useMemo<TagFilterRenderInfo>(() => {
    const counts = collectFacetCounts(catalog);

    const isActive = (facet: TagFilterFacet, val: string): boolean => {
      const list = value[facet];
      if (!list || list.length === 0) return false;
      return (list as readonly string[]).includes(val);
    };

    const toggle = (facet: TagFilterFacet, val: string) => {
      const list = (value[facet] ?? []) as readonly string[];
      const next = list.includes(val) ? list.filter((v) => v !== val) : [...list, val];
      onChange({ ...value, [facet]: next });
    };

    const options: TagFilterFacetOption[] = [];
    for (const facet of facets) {
      const valuesForFacet = counts[facet];
      const sorted = Array.from(valuesForFacet.entries()).sort(([a], [b]) => a.localeCompare(b));
      for (const [val, count] of sorted) {
        options.push({
          facet,
          value: val,
          active: isActive(facet, val),
          count,
          toggle: () => toggle(facet, val),
        });
      }
    }

    const clear = () => onChange({});

    return { options, clear, value };
  }, [catalog, value, onChange, facets]);

  if (children) return <>{children(info)}</>;

  return (
    <div data-tag-kit="filter">
      {info.options.map((opt) => (
        <button
          key={`${opt.facet}:${opt.value}`}
          type="button"
          data-tag-kit="filter-option"
          data-facet={opt.facet}
          data-value={opt.value}
          data-tag-kit-active={opt.active ? "true" : "false"}
          onClick={opt.toggle}
        >
          <span data-tag-kit="filter-label">{opt.value}</span>
          <span data-tag-kit="filter-count">{opt.count}</span>
        </button>
      ))}
    </div>
  );
}

function collectFacetCounts(
  catalog: readonly TagCatalogEntry[],
): Record<TagFilterFacet, Map<string, number>> {
  const severity = new Map<string, number>();
  const group = new Map<string, number>();
  const modality = new Map<string, number>();

  for (const entry of catalog) {
    severity.set(entry.severity, (severity.get(entry.severity) ?? 0) + 1);
    group.set(entry.group, (group.get(entry.group) ?? 0) + 1);
    for (const m of entry.applicableModalities) {
      modality.set(m, (modality.get(m) ?? 0) + 1);
    }
  }
  return { severity, group, modality };
}
