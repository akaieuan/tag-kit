/**
 * Ergonomic helpers for constructing catalog entries and combining catalogs.
 *
 * The verbose object-literal form remains supported (and is the canonical
 * shape after `.build()` returns). The builder exists to cut keystrokes
 * and surface sensible defaults for the boolean scope flags.
 */

import { defineCatalog, type TagCatalogEntry } from "./catalog.js";

/**
 * Chainable builder for a single catalog entry.
 *
 *     const TAG = tag("audio.harassment")
 *       .name("Audio harassment")
 *       .desc("Spoken harassment, slurs, or threats.")
 *       .severity("danger")
 *       .group("Audio")
 *       .modalities("audio", "video")
 *       .segments()      // turn on segment scope
 *       .build();
 *
 * Defaults:
 *   - severity: "neutral"
 *   - group: "Default"
 *   - applicableModalities: [] (universal — applies to every modality)
 *   - supportsSegmentScope: false
 *   - supportsSpanScope: false
 *
 * Required (must be set before build):
 *   - tagId (passed to `tag()`)
 *   - displayName (`.name()`)
 *   - description (`.desc()`)
 *
 * `.build()` validates the entry by piping it through `defineCatalog`,
 * so missing required fields throw with the same error codes as the
 * passthrough form.
 */
export function tag<TTagId extends string = string>(tagId: TTagId): TagBuilder<TTagId> {
  return new TagBuilder<TTagId>(tagId);
}

class TagBuilder<TTagId extends string> {
  private readonly _tagId: TTagId;
  private _displayName: string | undefined;
  private _description: string | undefined;
  private _severity: TagCatalogEntry["severity"] = "neutral";
  private _group = "Default";
  private _applicableModalities: readonly string[] = [];
  private _supportsSegmentScope = false;
  private _supportsSpanScope = false;

  constructor(tagId: TTagId) {
    this._tagId = tagId;
  }

  name(displayName: string): this {
    this._displayName = displayName;
    return this;
  }

  desc(description: string): this {
    this._description = description;
    return this;
  }

  severity(severity: TagCatalogEntry["severity"]): this {
    this._severity = severity;
    return this;
  }

  group(group: string): this {
    this._group = group;
    return this;
  }

  modalities<TModality extends string>(...modalities: TModality[]): this {
    this._applicableModalities = modalities;
    return this;
  }

  /** Turn on segment-scope support (time-bounded annotations). */
  segments(enable = true): this {
    this._supportsSegmentScope = enable;
    return this;
  }

  /** Turn on span-scope support (offset-bounded annotations). */
  spans(enable = true): this {
    this._supportsSpanScope = enable;
    return this;
  }

  /**
   * Materialize the entry. Throws if any required field is missing — the
   * same validation that `defineCatalog` applies, so a builder-produced
   * entry will always pass `defineCatalog([entry])`.
   */
  build(): TagCatalogEntry & { tagId: TTagId } {
    const entry: TagCatalogEntry = {
      tagId: this._tagId,
      displayName: this._displayName ?? "",
      description: this._description ?? "",
      severity: this._severity,
      group: this._group,
      applicableModalities: this._applicableModalities,
      supportsSegmentScope: this._supportsSegmentScope,
      supportsSpanScope: this._supportsSpanScope,
    };
    // Reuse the canonical validator. Throws on missing displayName/desc/etc.
    defineCatalog([entry]);
    return entry as TagCatalogEntry & { tagId: TTagId };
  }
}

/**
 * Combine multiple catalogs into one. Validates the result so duplicate
 * `tagId`s across catalogs surface as `DUPLICATE_TAG_ID` at merge time
 * (rather than later, deeper in scoring).
 *
 *     const FULL = mergeCatalogs(TEXT_CATALOG, IMAGE_CATALOG, VIDEO_CATALOG);
 *
 * Returns a new readonly array; inputs are not mutated. The returned
 * array preserves the input order: catalog A's entries come first, then
 * catalog B's, etc.
 */
export function mergeCatalogs<T extends TagCatalogEntry>(
  ...catalogs: readonly (readonly T[])[]
): readonly T[] {
  const merged = catalogs.flatMap((c) => [...c]);
  // Pipe through defineCatalog to surface duplicates with the standard error.
  defineCatalog(merged);
  return merged;
}

/**
 * Type-safe namespacing helper. Constrains every entry's `tagId` to the
 * `<modality>.<rest>` pattern at compile time, where `<modality>` must
 * be one of the supplied `modalities` tuple.
 *
 *     const C = defineNamespacedCatalog(["text", "image"] as const, [
 *       tag("text.toxic").name(...).desc(...).build(),
 *       tag("image.nsfw").name(...).desc(...).build(),
 *       tag("audio.bad").name(...).desc(...).build(),  // ❌ TS error
 *     ]);
 *
 * Pure type-level narrowing — runtime behavior is identical to
 * `defineCatalog`. Falls back to plain `defineCatalog` if you need
 * tagIds that don't follow the convention.
 */
export function defineNamespacedCatalog<
  const TModalities extends readonly string[],
  TEntries extends readonly NamespacedEntry<TModalities[number]>[],
>(_modalities: TModalities, entries: TEntries): TEntries {
  defineCatalog(entries);
  return entries;
}

/**
 * Catalog entry whose `tagId` is constrained to `${TModality}.${string}`.
 * Used by `defineNamespacedCatalog` to narrow the literal type.
 */
export type NamespacedEntry<TModality extends string> = TagCatalogEntry & {
  tagId: `${TModality}.${string}`;
};
