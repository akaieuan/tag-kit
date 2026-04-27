/**
 * Wire shapes for tags + expectations + agreement scores.
 *
 * Domain-agnostic by design — `modality` is a free string defined by the
 * consumer's catalog (e.g. "text" / "image" / "video.audio-track" /
 * "document.page-3"). `assetId` references whatever child entity the
 * consumer's domain attaches to a parent (a media asset, a paragraph,
 * a transcript turn).
 *
 * Two scope shapes cover most annotation work:
 *   - `segment` for time-bounded scopes (audio second 12-24, video frame range)
 *   - `span`    for offset-bounded scopes (character offsets, byte offsets,
 *               token positions)
 *
 * Anything beyond these — custom geometry, multi-region selection — should
 * compose at the consumer layer rather than expand the core schema.
 */

/**
 * Where on the annotated entity a tag applies. When all fields are absent,
 * the tag applies to the whole entity.
 *
 * The semantics of `segment.start/end` and `span.start/end` are defined by
 * the consumer (seconds vs. frames vs. samples; characters vs. bytes vs.
 * tokens). `tag-kit` doesn't enforce a unit so the same primitives work
 * across audio, video, text, document, and code annotation.
 */
export interface TagScope {
  modality?: string;
  assetId?: string;
  segment?: { start: number; end: number };
  span?: { start: number; end: number };
}

/**
 * One tag a reviewer (or any annotator) applied. Multiple tags per
 * decision is normal — the same artefact can carry several scoped
 * annotations.
 */
export interface ReviewerTag {
  /** Stable identifier from the consumer's catalog. */
  tagId: string;
  scope?: TagScope;
  /** Free-form annotator note — additional context the catalog tag can't
   *  capture. Surfaced in the dashboard chip's tooltip. */
  note?: string;
}

/**
 * A tag the consumer's gold-set says SHOULD have been applied. Pairs with
 * `ReviewerTag` for binary precision/recall agreement scoring.
 */
export interface ExpectedTag {
  tagId: string;
  scope?: TagScope;
  /** Labeler confidence. Consumers may use this to weight aggregates. */
  confidence?: "high" | "medium" | "low";
}

/**
 * Aggregated precision / recall / F1 for one tag across many annotated
 * entities. Returned by `tagPrecisionRecall` from `./scoring`.
 *
 * NaN is replaced with 0 throughout so the shape serializes cleanly even
 * when there are no positives.
 */
export interface TagAgreement {
  tagId: string;
  /** TP: expected ∧ predicted with overlapping scope. */
  truePositives: number;
  /** FP: predicted ∧ ¬expected. */
  falsePositives: number;
  /** FN: expected ∧ ¬predicted. */
  falseNegatives: number;
  /** TP / (TP + FP). 0 when no positives. */
  precision: number;
  /** TP / (TP + FN). 0 when no positives. */
  recall: number;
  /** Harmonic mean of precision + recall. 0 when both are 0. */
  f1: number;
  /** TP + FP + FN. The "interesting" sample count — entities where this tag
   *  was either expected or predicted. Pure true-negatives are excluded. */
  samples: number;
}
