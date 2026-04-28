/**
 * Tag catalog — the *index* of annotation vocabulary your domain offers.
 *
 * `tag-kit` doesn't ship a catalog. Each consumer defines their own with
 * `defineCatalog([...])` — content moderation will register `text.tone-violation`
 * and `audio.harassment`; medical chart annotation will register
 * `diagnosis.suggested` and `medication.contraindicated`. The catalog is the
 * stable contract; entries are referenced by `tagId` from
 * `ReviewerTag` / `ExpectedTag` rows.
 *
 * Naming convention recommendation: `<modality>.<category>` keeps catalogs
 * scannable, but `tag-kit` doesn't enforce it.
 */

/**
 * One entry in a TagCatalog. Generic over modality + group so consumers can
 * narrow the types in their domain (e.g.
 * `TagCatalogEntry<"text" | "image" | "video", "Toxicity" | "Privacy">`).
 */
export interface TagCatalogEntry<
  TModality extends string = string,
  TGroup extends string = string,
> {
  /** Stable identifier — FK from `ReviewerTag.tagId`. Never change once shipped. */
  tagId: string;
  /** Display label. Free to evolve. */
  displayName: string;
  /** One-liner shown in the picker tooltip and the chip hover. */
  description: string;
  /** Modalities the dashboard surfaces this tag for. Empty array = always shown. */
  applicableModalities: readonly TModality[];
  /** Visual tone for chips + sort priority for the picker. */
  severity: "info" | "warn" | "danger" | "neutral";
  /** Optional grouping for the picker (e.g. "Toxicity", "Privacy"). */
  group: TGroup;
  /** True iff the tag may be applied with a time-bounded scope. */
  supportsSegmentScope: boolean;
  /** True iff the tag may be applied with an offset-bounded scope. */
  supportsSpanScope: boolean;
}

/**
 * Helper that returns its argument typed as a readonly catalog. Use in
 * domain code to get exhaustive type narrowing on tagId / modality / group:
 *
 *     const CATALOG = defineCatalog([
 *       { tagId: "text.toxic", ... },
 *       { tagId: "image.nsfw", ... },
 *     ] as const);
 *
 * Pure passthrough — no validation. Validate at boot time if you load
 * catalogs from a config file.
 */
export function defineCatalog<TEntry extends TagCatalogEntry>(
  entries: readonly TEntry[],
): readonly TEntry[] {
  return entries;
}

/** Lookup by tagId. Returns undefined for unknown ids. O(n) — catalogs are small. */
export function findEntry<T extends TagCatalogEntry>(
  catalog: readonly T[],
  tagId: string,
): T | undefined {
  return catalog.find((e) => e.tagId === tagId);
}

/**
 * Filter the catalog by modality — the picker uses this to surface only
 * relevant tags for the asset under review. An entry with empty
 * `applicableModalities` matches every modality (a "universal" tag).
 */
export function filterByModality<T extends TagCatalogEntry>(
  catalog: readonly T[],
  modality: string,
): T[] {
  return catalog.filter(
    (e) => e.applicableModalities.length === 0 || e.applicableModalities.includes(modality),
  );
}

/** Bucket the catalog into `{ groupName: entries[] }` for the picker. */
export function groupByCategory<T extends TagCatalogEntry>(
  catalog: readonly T[],
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const e of catalog) {
    if (!out[e.group]) out[e.group] = [];
    out[e.group]!.push(e);
  }
  return out;
}
