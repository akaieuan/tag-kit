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

// -----------------------------------------------------------------------------
// Validation types — exported so consumers can format errors in their own UIs
// -----------------------------------------------------------------------------

/** Built-in validation rule codes. Custom rules may use any string code. */
export type BuiltInCatalogValidationCode =
  | "EMPTY_TAG_ID"
  | "DUPLICATE_TAG_ID"
  | "INVALID_TAG_ID_CHARS"
  | "EMPTY_DISPLAY_NAME"
  | "EMPTY_DESCRIPTION"
  | "EMPTY_GROUP";

/** Open string union so custom rules can ship their own codes. */
export type CatalogValidationCode = BuiltInCatalogValidationCode | (string & {});

/** One validation finding. `severity: "error"` blocks `defineCatalog` in
 *  strict mode; `"warn"` is informational and never throws. */
export interface CatalogValidationError {
  index: number;
  tagId?: string;
  code: CatalogValidationCode;
  severity: "error" | "warn";
  message: string;
}

/**
 * A consumer-supplied validation rule. Returns:
 *   - `null` if the entry passes
 *   - a `string` to fail with that message (uses the rule's default severity)
 *   - an object `{ message, severity }` to fail with explicit severity
 */
export interface CustomCatalogRule<T extends TagCatalogEntry = TagCatalogEntry> {
  /** Stable identifier for this rule. Surfaces in error messages. */
  code: string;
  /** Default severity if `validate` returns a bare string. Defaults to `"error"`. */
  severity?: "error" | "warn";
  validate: (
    entry: T,
    index: number,
    all: readonly T[],
  ) => string | { message: string; severity?: "error" | "warn" } | null;
}

/** Options accepted by `defineCatalog` and `validateCatalog`. */
export interface DefineCatalogOptions<T extends TagCatalogEntry = TagCatalogEntry> {
  /** Additional rules applied after the built-ins. */
  rules?: readonly CustomCatalogRule<T>[];
  /**
   * "strict" (default) — throw on any error-severity finding.
   * "warn"            — never throw; emit console.warn for each finding.
   */
  severity?: "strict" | "warn";
}

/** Aggregated validation result returned by `validateCatalog`. */
export interface ValidateCatalogResult {
  /** True iff there are no `error`-severity findings (warnings are tolerated). */
  ok: boolean;
  errors: readonly CatalogValidationError[];
  warnings: readonly CatalogValidationError[];
  /** All findings (errors ∪ warnings) in their original order. */
  all: readonly CatalogValidationError[];
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Helper that returns its argument typed as a readonly catalog. Validates
 * entries at the boot-time call site.
 *
 *     const CATALOG = defineCatalog([...]);
 *
 *     // With custom rules:
 *     defineCatalog(entries, {
 *       rules: [{
 *         code: "TAG_ID_PREFIX",
 *         validate: (e) => e.tagId.startsWith("text.") ? null : "must start with text.",
 *       }],
 *     });
 *
 *     // Tolerant mode — never throws, emits console.warn:
 *     defineCatalog(entries, { severity: "warn" });
 *
 * Default behavior unchanged from 0.2.x: built-in rules run, errors throw.
 */
export function defineCatalog<TEntry extends TagCatalogEntry>(
  entries: readonly TEntry[],
  options?: DefineCatalogOptions<TEntry>,
): readonly TEntry[] {
  const result = validateCatalog(entries, { rules: options?.rules });
  const mode = options?.severity ?? "strict";

  if (mode === "warn") {
    for (const finding of result.all) {
      console.warn(formatSingleFinding(finding));
    }
    return entries;
  }

  // strict mode
  if (result.errors.length > 0) {
    throw new Error(formatCatalogErrors(result.errors));
  }
  // Warnings still surface even in strict mode — they're informational, never block.
  for (const finding of result.warnings) {
    console.warn(formatSingleFinding(finding));
  }
  return entries;
}

/**
 * Validate a catalog without throwing. Returns the result as data so
 * consumers loading catalogs from config files (YAML, JSON, etc.) can
 * surface errors to the user instead of crashing the app.
 *
 *     const result = validateCatalog(entries);
 *     if (!result.ok) {
 *       for (const err of result.errors) console.error(err);
 *     }
 */
export function validateCatalog<TEntry extends TagCatalogEntry>(
  entries: readonly TEntry[],
  options?: { rules?: readonly CustomCatalogRule<TEntry>[] },
): ValidateCatalogResult {
  const findings: CatalogValidationError[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const trimmedTagId = entry.tagId?.trim() ?? "";

    // Built-in: tagId presence + character set + uniqueness
    if (trimmedTagId === "") {
      findings.push({
        index: i,
        code: "EMPTY_TAG_ID",
        severity: "error",
        message: "tagId is empty or whitespace-only",
      });
    } else if (!VALID_TAG_ID_PATTERN.test(entry.tagId)) {
      findings.push({
        index: i,
        tagId: entry.tagId,
        code: "INVALID_TAG_ID_CHARS",
        severity: "error",
        message: `tagId "${entry.tagId}" contains characters outside [a-zA-Z0-9._:-]`,
      });
    } else {
      const previous = seen.get(entry.tagId);
      if (previous !== undefined) {
        findings.push({
          index: i,
          tagId: entry.tagId,
          code: "DUPLICATE_TAG_ID",
          severity: "error",
          message: `tagId "${entry.tagId}" duplicates entry at index ${previous}`,
        });
      } else {
        seen.set(entry.tagId, i);
      }
    }

    // Built-in: required strings
    if (!entry.displayName || entry.displayName.trim() === "") {
      findings.push({
        index: i,
        tagId: entry.tagId || undefined,
        code: "EMPTY_DISPLAY_NAME",
        severity: "error",
        message: "displayName is empty or whitespace-only",
      });
    }
    if (!entry.description || entry.description.trim() === "") {
      findings.push({
        index: i,
        tagId: entry.tagId || undefined,
        code: "EMPTY_DESCRIPTION",
        severity: "error",
        message: "description is empty or whitespace-only",
      });
    }
    if (!entry.group || entry.group.trim() === "") {
      findings.push({
        index: i,
        tagId: entry.tagId || undefined,
        code: "EMPTY_GROUP",
        severity: "error",
        message: "group is empty or whitespace-only",
      });
    }

    // Custom rules
    for (const rule of options?.rules ?? []) {
      const result = rule.validate(entry, i, entries);
      if (result === null) continue;
      const defaultSeverity = rule.severity ?? "error";
      if (typeof result === "string") {
        findings.push({
          index: i,
          tagId: entry.tagId || undefined,
          code: rule.code,
          severity: defaultSeverity,
          message: result,
        });
      } else {
        findings.push({
          index: i,
          tagId: entry.tagId || undefined,
          code: rule.code,
          severity: result.severity ?? defaultSeverity,
          message: result.message,
        });
      }
    }
  }

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warn");
  return { ok: errors.length === 0, errors, warnings, all: findings };
}

const VALID_TAG_ID_PATTERN = /^[a-zA-Z0-9._:-]+$/;

function formatCatalogErrors(errors: readonly CatalogValidationError[]): string {
  const header =
    errors.length === 1
      ? "defineCatalog: 1 invalid entry"
      : `defineCatalog: ${errors.length} invalid entries`;
  const lines = errors.map((e) => formatSingleFinding(e));
  return `${header}\n${lines.join("\n")}`;
}

function formatSingleFinding(f: CatalogValidationError): string {
  const idLabel = f.tagId ? ` tagId="${f.tagId}"` : "";
  const sevLabel = f.severity === "warn" ? " (warn)" : "";
  return `  [index ${f.index}]${idLabel} ${f.code}${sevLabel}: ${f.message}`;
}

// -----------------------------------------------------------------------------
// Lookup helpers (unchanged)
// -----------------------------------------------------------------------------

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
