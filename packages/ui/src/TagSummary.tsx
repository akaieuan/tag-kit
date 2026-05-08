import { useMemo, type ReactNode } from "react";
import type { ReviewerTag, TagCatalogEntry } from "@tag-kit/core";

export type TagSummaryGroupBy = "tagId" | "modality" | "severity" | "group";

export interface TagSummaryEntry {
  /** The bucket key — e.g. `"text"` when `groupBy: "modality"`. */
  key: string;
  /** Number of tags in this bucket. */
  count: number;
  /** The tags in this bucket, preserving input order. */
  tags: readonly ReviewerTag[];
}

export interface TagSummaryRenderInfo {
  buckets: readonly TagSummaryEntry[];
  total: number;
}

export interface TagSummaryProps {
  /** Tags to summarize. */
  tags: readonly ReviewerTag[];
  /** Optional catalog used to resolve `severity` / `group` / `modality`
   *  for tags whose grouping isn't `tagId`. Without it, those groupings
   *  bucket every tag under `"unknown"`. */
  catalog?: readonly TagCatalogEntry[];
  /** What to bucket by. Defaults to `"tagId"`. */
  groupBy?: TagSummaryGroupBy;
  /** Replace the default markup with your own — receives the bucketed
   *  summary plus the total. Render-prop pattern matches TagPicker / TagChip. */
  children?: (info: TagSummaryRenderInfo) => ReactNode;
}

/**
 * Headless summary of a tag set — counts per `tagId`, `modality`,
 * `severity`, or `group`. Renders zero styles by default; emits
 * `data-tag-kit-*` attributes the consumer styles. Pass `children` to
 * take full control over the markup.
 *
 *     <TagSummary tags={staged} catalog={CATALOG} groupBy="severity" />
 *     // → <ul data-tag-kit="summary">
 *     //     <li data-tag-kit="summary-bucket" data-key="danger">danger: 3</li>
 *     //     ...
 *     //   </ul>
 */
export function TagSummary({ tags, catalog, groupBy = "tagId", children }: TagSummaryProps) {
  const info = useMemo<TagSummaryRenderInfo>(() => {
    const entryByTagId = new Map<string, TagCatalogEntry>();
    for (const entry of catalog ?? []) entryByTagId.set(entry.tagId, entry);

    const buckets = new Map<string, ReviewerTag[]>();
    for (const tag of tags) {
      const entry = entryByTagId.get(tag.tagId);
      const key = bucketKey(tag, entry, groupBy);
      const list = buckets.get(key) ?? [];
      list.push(tag);
      buckets.set(key, list);
    }

    const ordered: TagSummaryEntry[] = [];
    for (const [key, ts] of buckets) {
      ordered.push({ key, count: ts.length, tags: ts });
    }
    ordered.sort((a, b) => a.key.localeCompare(b.key));

    return { buckets: ordered, total: tags.length };
  }, [tags, catalog, groupBy]);

  if (children) return <>{children(info)}</>;

  return (
    <ul data-tag-kit="summary" data-tag-kit-group-by={groupBy}>
      {info.buckets.map((b) => (
        <li key={b.key} data-tag-kit="summary-bucket" data-key={b.key}>
          <span data-tag-kit="summary-key">{b.key}</span>
          <span data-tag-kit="summary-count">{b.count}</span>
        </li>
      ))}
    </ul>
  );
}

function bucketKey(
  tag: ReviewerTag,
  entry: TagCatalogEntry | undefined,
  groupBy: TagSummaryGroupBy,
): string {
  switch (groupBy) {
    case "tagId":
      return tag.tagId;
    case "modality":
      // Prefer the tag's own scope.modality, else infer from the catalog
      // entry's applicableModalities (when there's exactly one), else "unknown".
      if (tag.scope?.modality) return tag.scope.modality;
      if (entry?.applicableModalities.length === 1) return entry.applicableModalities[0]!;
      return "unknown";
    case "severity":
      return entry?.severity ?? "unknown";
    case "group":
      return entry?.group ?? "unknown";
  }
}
