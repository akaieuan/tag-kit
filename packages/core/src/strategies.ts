/**
 * Pluggable matching strategies — alternative rules for "did annotator A
 * and B agree?" beyond the conservative default in `matching.ts`.
 *
 * The default `tagsMatch` (and therefore `tagPrecisionRecall`) uses
 * `strictMatch`, which is what shipped in 0.1.x. Other strategies are
 * opt-in: callers pass them as the optional final argument.
 *
 * Strategies are pure: they take two tag-like values and return a boolean.
 * That makes them composable — wrap one in another, or chain via
 * `combineStrategies(...)`.
 */

import { scopeOverlaps, tagsMatch } from "./matching.js";
import type { ExpectedTag, ReviewerTag, TagScope } from "./schema.js";

/** A tag with the minimum fields a strategy can rely on. */
export interface MatchableTag {
  tagId: string;
  scope?: TagScope;
  /** Optional confidence — only `ExpectedTag` carries this; predicted tags
   *  may be cast to MatchableTag with confidence undefined. Matches the
   *  three-level enum used by `ExpectedTag.confidence`. */
  confidence?: "high" | "medium" | "low";
}

const CONFIDENCE_ORDER = { low: 1, medium: 2, high: 3 } as const;
type ConfidenceLevel = keyof typeof CONFIDENCE_ORDER;

/**
 * A strategy is just a boolean predicate over two tags. Library-built
 * strategies are objects with a `match` function so they can carry
 * configuration (e.g. fuzzy distance) in their closure.
 */
export interface MatchStrategy {
  /** Friendly name surfaced in errors / logs. */
  readonly name: string;
  match(a: MatchableTag, b: MatchableTag): boolean;
}

// -----------------------------------------------------------------------------
// strict — the 0.1.x default
// -----------------------------------------------------------------------------

/**
 * Conservative match — `tagId` equality + scope overlap with half-open
 * intervals. This is what `tagsMatch` uses by default.
 */
export const strictMatch: MatchStrategy = {
  name: "strict",
  match(a, b) {
    return tagsMatch(a, b);
  },
};

// -----------------------------------------------------------------------------
// loose — closed intervals (touching ranges count as overlap)
// -----------------------------------------------------------------------------

/**
 * Loose match — like `strict`, but ranges that touch at the boundary
 * count as overlapping. Use when the consumer's `start`/`end` values
 * are inclusive (e.g. frame indices that semantically include their endpoint).
 *
 * Example: `[10, 20]` and `[20, 30]` → `loose` says match, `strict` does not.
 */
export const looseMatch: MatchStrategy = {
  name: "loose",
  match(a, b) {
    if (a.tagId !== b.tagId) return false;
    return looseScopeOverlaps(a.scope, b.scope);
  },
};

function looseScopeOverlaps(
  a: TagScope | undefined | null,
  b: TagScope | undefined | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return true;
  if (a.modality && b.modality && a.modality !== b.modality) return false;
  if (a.assetId && b.assetId && a.assetId !== b.assetId) return false;
  if (a.segment && b.segment) {
    if (!closedRangesOverlap(a.segment.start, a.segment.end, b.segment.start, b.segment.end)) {
      return false;
    }
  }
  if (a.span && b.span) {
    if (!closedRangesOverlap(a.span.start, a.span.end, b.span.start, b.span.end)) {
      return false;
    }
  }
  return true;
}

/** Closed-interval intersection: `[aStart, aEnd] ∩ [bStart, bEnd] ≠ ∅`. */
function closedRangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

// -----------------------------------------------------------------------------
// fuzzy — typo-tolerant tagId matching
// -----------------------------------------------------------------------------

/**
 * Fuzzy match — tolerate typos in `tagId` up to a Levenshtein distance.
 * Scope rules are identical to `strict`.
 *
 *     fuzzyMatch({ distance: 2 })  // tolerate up to 2 single-char edits
 *
 * Distance defaults to `1` (a single typo). At distance 0, behavior is
 * equivalent to `strictMatch`.
 *
 * Hand-rolled Levenshtein — no external deps. O(m*n) per comparison,
 * which is fine for short tagIds (typical: 10–30 chars).
 */
export function fuzzyMatch(opts?: { distance?: number }): MatchStrategy {
  const maxDistance = opts?.distance ?? 1;
  return {
    name: `fuzzy(${maxDistance})`,
    match(a, b) {
      if (a.tagId === b.tagId) {
        return scopeOverlaps(a.scope, b.scope);
      }
      if (levenshtein(a.tagId, b.tagId) > maxDistance) return false;
      return scopeOverlaps(a.scope, b.scope);
    },
  };
}

/**
 * Levenshtein edit distance (insertion / deletion / substitution).
 * Iterative two-row DP — O(m*n) time, O(min(m,n)) space.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Make `a` the shorter one so we allocate the smaller row.
  if (a.length > b.length) [a, b] = [b, a];

  const m = a.length;
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(curr[i - 1]! + 1, prev[i]! + 1, prev[i - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m]!;
}

// -----------------------------------------------------------------------------
// confident — gate by ExpectedTag.confidence
// -----------------------------------------------------------------------------

/**
 * Confidence-gated match — pure filter that returns true iff both tags
 * meet `minConfidence`. Does NOT check `tagId` or `scope` — compose with
 * `strictMatch` / `looseMatch` / `fuzzyMatch` via `combineStrategies` to
 * stack a confidence gate on top of tag-identity rules.
 *
 *     // Strict tagId+scope AND confidence ≥ medium:
 *     combineStrategies(strictMatch, confidentMatch({ minConfidence: "medium" }))
 *
 *     // Fuzzy tagId AND confidence ≥ high:
 *     combineStrategies(fuzzyMatch({ distance: 1 }), confidentMatch({ minConfidence: "high" }))
 *
 * Tags without a `confidence` field are treated as fully confident
 * ("high") — only `ExpectedTag` carries this field; `ReviewerTag` sources
 * typically don't.
 *
 * Confidence ordering: `low < medium < high`.
 */
export function confidentMatch(opts: { minConfidence: ConfidenceLevel }): MatchStrategy {
  const min = CONFIDENCE_ORDER[opts.minConfidence];
  return {
    name: `confident(${opts.minConfidence})`,
    match(a, b) {
      const aLevel = a.confidence ? CONFIDENCE_ORDER[a.confidence] : CONFIDENCE_ORDER.high;
      const bLevel = b.confidence ? CONFIDENCE_ORDER[b.confidence] : CONFIDENCE_ORDER.high;
      return aLevel >= min && bLevel >= min;
    },
  };
}

// -----------------------------------------------------------------------------
// composition
// -----------------------------------------------------------------------------

/**
 * Combine multiple strategies — match if ALL strategies agree. Useful for
 * stacking constraints (e.g. fuzzy + confident).
 */
export function combineStrategies(...strategies: readonly MatchStrategy[]): MatchStrategy {
  if (strategies.length === 0) return strictMatch;
  if (strategies.length === 1) return strategies[0]!;
  return {
    name: `combine(${strategies.map((s) => s.name).join(",")})`,
    match(a, b) {
      return strategies.every((s) => s.match(a, b));
    },
  };
}

// -----------------------------------------------------------------------------
// strategy-aware tag matcher (re-exported convenience)
// -----------------------------------------------------------------------------

/**
 * Match two tags using the supplied strategy. Equivalent to calling
 * `strategy.match(a, b)` directly — provided for readability at call sites.
 */
export function tagsMatchWith(
  a: ReviewerTag | ExpectedTag,
  b: ReviewerTag | ExpectedTag,
  strategy: MatchStrategy = strictMatch,
): boolean {
  return strategy.match(a, b);
}
