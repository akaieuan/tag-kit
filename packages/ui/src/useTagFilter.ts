import { useMemo } from "react";
import { filterByModality, type ReviewerTag, type TagCatalogEntry } from "@tag-kit/core";

export interface UseTagFilterOptions {
  /** Restrict to tags whose catalog entry has this modality (or empty
   *  applicableModalities). Pass null/undefined to skip the modality
   *  filter. */
  modality?: string | null;
  /** Restrict to tags whose catalog entry severity is in this allowlist.
   *  Empty array or undefined skips the severity filter. */
  severity?: readonly TagCatalogEntry["severity"][];
  /** Restrict to tags whose catalog entry group is in this allowlist.
   *  Empty array or undefined skips the group filter. */
  group?: readonly string[];
  /** Free-text query — matched (case-insensitively, substring) against
   *  `tagId`, the catalog entry's `displayName`, and `description`. */
  query?: string;
}

/**
 * Filter a list of `ReviewerTag`s through any combination of modality,
 * severity, group, and free-text query — using the supplied catalog as
 * the source of truth for severity / group / displayName / description.
 *
 * Tags whose `tagId` is not in the catalog are kept (you may be rendering
 * a chip for an unknown tagId during catalog-loading) — they only match
 * the `query` filter against their own `tagId`.
 *
 *     const visible = useTagFilter(staged, {
 *       modality: "text",
 *       severity: ["danger", "warn"],
 *       query: search,
 *     });
 */
export function useTagFilter(
  tags: readonly ReviewerTag[],
  options: UseTagFilterOptions,
  catalog?: readonly TagCatalogEntry[],
): readonly ReviewerTag[] {
  const { modality, severity, group, query } = options;

  return useMemo(() => {
    const allowedSeverity = severity && severity.length > 0 ? new Set(severity) : null;
    const allowedGroup = group && group.length > 0 ? new Set(group) : null;
    const trimmedQuery = query?.trim().toLowerCase() ?? "";

    // Build a fast tagId → entry lookup once per filter pass.
    const entryByTagId = new Map<string, TagCatalogEntry>();
    for (const entry of catalog ?? []) entryByTagId.set(entry.tagId, entry);

    // If a modality is set, narrow the catalog first so we know which
    // tagIds qualify under modality rules.
    const modalityAllowed =
      modality != null
        ? new Set(filterByModality(catalog ?? [], modality).map((e) => e.tagId))
        : null;

    return tags.filter((tag) => {
      const entry = entryByTagId.get(tag.tagId);

      if (modalityAllowed && !modalityAllowed.has(tag.tagId)) return false;

      if (allowedSeverity && entry && !allowedSeverity.has(entry.severity)) {
        return false;
      }
      if (allowedGroup && entry && !allowedGroup.has(entry.group)) {
        return false;
      }

      if (trimmedQuery.length > 0) {
        const haystack = [
          tag.tagId,
          entry?.displayName ?? "",
          entry?.description ?? "",
          tag.note ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(trimmedQuery)) return false;
      }

      return true;
    });
  }, [tags, modality, severity, group, query, catalog]);
}
