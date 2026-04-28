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
 * Validates entries at the boot-time call site and throws on:
 *   - empty/whitespace `tagId`
 *   - duplicate `tagId`
 *   - `tagId` containing characters outside `[a-zA-Z0-9._:-]`
 *   - empty/whitespace `displayName`, `description`, or `group`
 *
 * On invalid input, throws an `Error` whose message lists every error
 * with its `[index N]` and the entry's `tagId`. On valid input, returns
 * the input unchanged.
 */
export function defineCatalog<TEntry extends TagCatalogEntry>(
  entries: readonly TEntry[],
): readonly TEntry[] {
  const errors = validateCatalogEntries(entries);
  if (errors.length > 0) {
    throw new Error(formatCatalogErrors(errors));
  }
  return entries;
}

type CatalogValidationCode =
  | "EMPTY_TAG_ID"
  | "DUPLICATE_TAG_ID"
  | "INVALID_TAG_ID_CHARS"
  | "EMPTY_DISPLAY_NAME"
  | "EMPTY_DESCRIPTION"
  | "EMPTY_GROUP";

interface CatalogValidationError {
  index: number;
  tagId?: string;
  code: CatalogValidationCode;
  message: string;
}

const VALID_TAG_ID_PATTERN = /^[a-zA-Z0-9._:-]+$/;

function validateCatalogEntries(entries: readonly TagCatalogEntry[]): CatalogValidationError[] {
  const errors: CatalogValidationError[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const trimmedTagId = entry.tagId?.trim() ?? "";

    if (trimmedTagId === "") {
      errors.push({
        index: i,
        code: "EMPTY_TAG_ID",
        message: "tagId is empty or whitespace-only",
      });
    } else if (!VALID_TAG_ID_PATTERN.test(entry.tagId)) {
      errors.push({
        index: i,
        tagId: entry.tagId,
        code: "INVALID_TAG_ID_CHARS",
        message: `tagId "${entry.tagId}" contains characters outside [a-zA-Z0-9._:-]`,
      });
    } else {
      const previous = seen.get(entry.tagId);
      if (previous !== undefined) {
        errors.push({
          index: i,
          tagId: entry.tagId,
          code: "DUPLICATE_TAG_ID",
          message: `tagId "${entry.tagId}" duplicates entry at index ${previous}`,
        });
      } else {
        seen.set(entry.tagId, i);
      }
    }

    if (!entry.displayName || entry.displayName.trim() === "") {
      errors.push({
        index: i,
        tagId: entry.tagId || undefined,
        code: "EMPTY_DISPLAY_NAME",
        message: "displayName is empty or whitespace-only",
      });
    }
    if (!entry.description || entry.description.trim() === "") {
      errors.push({
        index: i,
        tagId: entry.tagId || undefined,
        code: "EMPTY_DESCRIPTION",
        message: "description is empty or whitespace-only",
      });
    }
    if (!entry.group || entry.group.trim() === "") {
      errors.push({
        index: i,
        tagId: entry.tagId || undefined,
        code: "EMPTY_GROUP",
        message: "group is empty or whitespace-only",
      });
    }
  }

  return errors;
}

function formatCatalogErrors(errors: readonly CatalogValidationError[]): string {
  const header =
    errors.length === 1
      ? "defineCatalog: 1 invalid entry"
      : `defineCatalog: ${errors.length} invalid entries`;
  const lines = errors.map((e) => {
    const idLabel = e.tagId ? ` tagId="${e.tagId}"` : "";
    return `  [index ${e.index}]${idLabel} ${e.code}: ${e.message}`;
  });
  return `${header}\n${lines.join("\n")}`;
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
