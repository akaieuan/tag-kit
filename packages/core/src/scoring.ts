import type { ExpectedTag, ReviewerTag, TagAgreement } from "./schema.js";
import { tagsMatch } from "./matching.js";

/**
 * Agreement scoring — precision / recall / F1 per tag, aggregated across
 * many entities.
 *
 * Tag scoring is binary, not probabilistic. For each entity in the dataset:
 *   - true positive : expected ∧ predicted (matching scopes via tagsMatch)
 *   - false positive: predicted ∧ ¬expected
 *   - false negative: expected ∧ ¬predicted
 *
 * `samples` counts only "interesting" entities — pure true-negatives
 * (entity has no expected and no predicted tag of this id) don't contribute,
 * because they'd dominate the count and make the metric meaningless.
 *
 * NaN is replaced with 0 throughout so the wire shape serializes cleanly.
 */
export interface TaggedEntity {
  /** Stable id for the entity being scored — only used to keep callers'
   *  expected and predicted aligned. Never inspected by the scorer. */
  entityId: string;
  expected: readonly ExpectedTag[];
  predicted: readonly ReviewerTag[];
}

/**
 * Compute per-tag agreement across many entities. Returns one
 * `TagAgreement` row per `tagId` that appeared in either the expected or
 * predicted set on any entity.
 *
 * Stable sort: alphabetical by tagId so dashboards render consistently
 * across runs.
 */
export function tagPrecisionRecall(entities: readonly TaggedEntity[]): TagAgreement[] {
  // Per-tag accumulators: tagId → counts.
  const counts = new Map<string, { tp: number; fp: number; fn: number }>();

  const bump = (tagId: string, key: "tp" | "fp" | "fn") => {
    const c = counts.get(tagId) ?? { tp: 0, fp: 0, fn: 0 };
    c[key] += 1;
    counts.set(tagId, c);
  };

  for (const entity of entities) {
    // Index expected by tagId so we can match each predicted against
    // candidates with the same id and overlapping scope.
    const expectedByTag = new Map<string, ExpectedTag[]>();
    for (const e of entity.expected) {
      const arr = expectedByTag.get(e.tagId) ?? [];
      arr.push(e);
      expectedByTag.set(e.tagId, arr);
    }

    // Match predicted → expected. Each expected slot is consumed at most
    // once so reviewers tagging the same span twice don't get double credit.
    const consumed = new Set<ExpectedTag>();
    for (const p of entity.predicted) {
      const candidates = expectedByTag.get(p.tagId) ?? [];
      const match = candidates.find((e) => !consumed.has(e) && tagsMatch(p, e));
      if (match) {
        consumed.add(match);
        bump(p.tagId, "tp");
      } else {
        bump(p.tagId, "fp");
      }
    }

    // Anything in expected we didn't consume is a false negative.
    for (const e of entity.expected) {
      if (!consumed.has(e)) bump(e.tagId, "fn");
    }
  }

  const results: TagAgreement[] = [];
  for (const [tagId, c] of counts) {
    const precision = c.tp + c.fp === 0 ? 0 : c.tp / (c.tp + c.fp);
    const recall = c.tp + c.fn === 0 ? 0 : c.tp / (c.tp + c.fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    results.push({
      tagId,
      truePositives: c.tp,
      falsePositives: c.fp,
      falseNegatives: c.fn,
      precision,
      recall,
      f1,
      samples: c.tp + c.fp + c.fn,
    });
  }
  results.sort((a, b) => a.tagId.localeCompare(b.tagId));
  return results;
}

/** Lightweight aggregator for one tag at a time — useful when callers
 *  pre-bucketed by tagId. Same scoring rules as `tagPrecisionRecall`. */
export interface BinarySample {
  expected: boolean;
  predicted: boolean;
}

export function binaryAgreement(tagId: string, samples: readonly BinarySample[]): TagAgreement {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const s of samples) {
    if (s.expected && s.predicted) tp += 1;
    else if (!s.expected && s.predicted) fp += 1;
    else if (s.expected && !s.predicted) fn += 1;
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    tagId,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision,
    recall,
    f1,
    samples: tp + fp + fn,
  };
}
