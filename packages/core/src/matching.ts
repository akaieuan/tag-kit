import type { TagScope } from "./schema.js";

/**
 * Scope-overlap rules — when does annotator A's tag count as agreeing with
 * annotator B's tag of the same `tagId`?
 *
 * The conservative interpretation: scopes overlap when they could plausibly
 * refer to the same evidence. This means:
 *
 *  - Both undefined → match (both annotators tagged the whole entity).
 *  - Different `modality` → no match (text-tag ≠ audio-tag).
 *  - Different `assetId` → no match (different child asset).
 *  - Same modality + same assetId + segment ranges intersect → match.
 *  - Same modality + same assetId + span ranges intersect → match.
 *  - One has a fine-grained scope (segment / span / assetId) and the other is
 *    broader (whole-modality, or no scope) → match. The broader scope
 *    contains the narrower one, so they're talking about the same evidence.
 *
 * `tag-kit` deliberately doesn't try to interpret unknown fields — if your
 * domain needs custom geometry (polygon ROI, multi-region selection), wrap
 * `scopeOverlaps` and add the extra check at the domain layer.
 */
export function scopeOverlaps(
  a: TagScope | undefined | null,
  b: TagScope | undefined | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return true; // one whole-entity scope contains the other

  // Modality mismatch is a hard no.
  if (a.modality && b.modality && a.modality !== b.modality) return false;

  // AssetId mismatch is a hard no — different child assets aren't the same evidence.
  if (a.assetId && b.assetId && a.assetId !== b.assetId) return false;

  // Segment intersection — only checked when BOTH have segments. If one has a
  // segment and the other doesn't, the segment-less side is broader and
  // contains the segmented one (within the same modality / asset).
  if (a.segment && b.segment) {
    if (!rangesOverlap(a.segment.start, a.segment.end, b.segment.start, b.segment.end)) {
      return false;
    }
  }

  // Span intersection — same rule as segment.
  if (a.span && b.span) {
    if (!rangesOverlap(a.span.start, a.span.end, b.span.start, b.span.end)) {
      return false;
    }
  }

  return true;
}

/** Two tags match if they share a tagId AND their scopes overlap per
 *  `scopeOverlaps`. Used in agreement scoring to decide TP / FP / FN. */
export function tagsMatch(
  a: { tagId: string; scope?: TagScope },
  b: { tagId: string; scope?: TagScope },
): boolean {
  if (a.tagId !== b.tagId) return false;
  return scopeOverlaps(a.scope, b.scope);
}

/** Half-open interval intersection: [aStart, aEnd) ∩ [bStart, bEnd) ≠ ∅. */
function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
