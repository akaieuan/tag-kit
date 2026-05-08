import { describe, expect, it } from "vitest";
import {
  combineStrategies,
  confidentMatch,
  fuzzyMatch,
  looseMatch,
  strictMatch,
  tagsMatchWith,
  tagPrecisionRecall,
  type MatchableTag,
} from "../src/index.js";

describe("strictMatch", () => {
  it("is the conservative default — half-open intervals don't match at the boundary", () => {
    const a: MatchableTag = {
      tagId: "audio.harassment",
      scope: { modality: "audio", segment: { start: 0, end: 10 } },
    };
    const b: MatchableTag = {
      tagId: "audio.harassment",
      scope: { modality: "audio", segment: { start: 10, end: 20 } },
    };
    expect(strictMatch.match(a, b)).toBe(false);
  });

  it("matches when tagIds equal and scopes overlap", () => {
    const a: MatchableTag = {
      tagId: "audio.harassment",
      scope: { modality: "audio", segment: { start: 0, end: 15 } },
    };
    const b: MatchableTag = {
      tagId: "audio.harassment",
      scope: { modality: "audio", segment: { start: 10, end: 20 } },
    };
    expect(strictMatch.match(a, b)).toBe(true);
  });
});

describe("looseMatch", () => {
  it("considers touching ranges as overlapping", () => {
    const a: MatchableTag = {
      tagId: "audio.harassment",
      scope: { modality: "audio", segment: { start: 0, end: 10 } },
    };
    const b: MatchableTag = {
      tagId: "audio.harassment",
      scope: { modality: "audio", segment: { start: 10, end: 20 } },
    };
    expect(looseMatch.match(a, b)).toBe(true);
  });

  it("disjoint ranges still don't match", () => {
    const a: MatchableTag = {
      tagId: "audio.harassment",
      scope: { modality: "audio", segment: { start: 0, end: 5 } },
    };
    const b: MatchableTag = {
      tagId: "audio.harassment",
      scope: { modality: "audio", segment: { start: 10, end: 20 } },
    };
    expect(looseMatch.match(a, b)).toBe(false);
  });

  it("modality mismatch is still hard no, even loose", () => {
    const a: MatchableTag = { tagId: "x.y", scope: { modality: "audio" } };
    const b: MatchableTag = { tagId: "x.y", scope: { modality: "video" } };
    expect(looseMatch.match(a, b)).toBe(false);
  });
});

describe("fuzzyMatch", () => {
  it("matches identical tagIds (fast path)", () => {
    const a: MatchableTag = { tagId: "audio.harassment" };
    const b: MatchableTag = { tagId: "audio.harassment" };
    expect(fuzzyMatch().match(a, b)).toBe(true);
  });

  it("matches one-character typos by default", () => {
    const a: MatchableTag = { tagId: "audio.harassment" };
    const b: MatchableTag = { tagId: "audio.harasment" }; // missing one s
    expect(fuzzyMatch().match(a, b)).toBe(true);
  });

  it("rejects tagIds beyond the configured distance", () => {
    const a: MatchableTag = { tagId: "audio.harassment" };
    const b: MatchableTag = { tagId: "audio.violence" };
    expect(fuzzyMatch({ distance: 2 }).match(a, b)).toBe(false);
  });

  it("distance 0 equals strict tagId equality", () => {
    const a: MatchableTag = { tagId: "audio.harassment" };
    const b: MatchableTag = { tagId: "audio.harasment" };
    expect(fuzzyMatch({ distance: 0 }).match(a, b)).toBe(false);
  });

  it("respects scope overlap rules — typo + disjoint scope is still a no", () => {
    const a: MatchableTag = {
      tagId: "audio.harassment",
      scope: { modality: "audio", segment: { start: 0, end: 5 } },
    };
    const b: MatchableTag = {
      tagId: "audio.harasment",
      scope: { modality: "audio", segment: { start: 10, end: 15 } },
    };
    expect(fuzzyMatch({ distance: 1 }).match(a, b)).toBe(false);
  });
});

describe("confidentMatch", () => {
  it("rejects when one side's confidence is below threshold", () => {
    const a: MatchableTag = { tagId: "audio.harassment", confidence: "low" };
    const b: MatchableTag = { tagId: "audio.harassment" };
    expect(confidentMatch({ minConfidence: "medium" }).match(a, b)).toBe(false);
  });

  it("accepts when both sides meet the threshold", () => {
    const a: MatchableTag = { tagId: "audio.harassment", confidence: "high" };
    const b: MatchableTag = { tagId: "audio.harassment", confidence: "medium" };
    expect(confidentMatch({ minConfidence: "medium" }).match(a, b)).toBe(true);
  });

  it("treats undefined confidence as high (fully confident)", () => {
    const a: MatchableTag = { tagId: "audio.harassment" };
    const b: MatchableTag = { tagId: "audio.harassment", confidence: "high" };
    expect(confidentMatch({ minConfidence: "high" }).match(a, b)).toBe(true);
  });

  it("is a pure confidence filter — does not check tagId or scope", () => {
    // Both confidence pass, totally different tagIds — confident says match.
    // (Compose with strictMatch via combineStrategies for tagId-aware checks.)
    const a: MatchableTag = { tagId: "audio.harassment", confidence: "high" };
    const b: MatchableTag = { tagId: "video.violence", confidence: "high" };
    expect(confidentMatch({ minConfidence: "medium" }).match(a, b)).toBe(true);
  });

  it("composes with strictMatch via combineStrategies for the full check", () => {
    const stacked = combineStrategies(strictMatch, confidentMatch({ minConfidence: "medium" }));
    // tagId mismatch — strict says no, so combined says no even though confidence passes.
    expect(
      stacked.match(
        { tagId: "audio.harassment", confidence: "high" },
        { tagId: "video.violence", confidence: "high" },
      ),
    ).toBe(false);
    // tagId match + confidence ok → combined says yes.
    expect(
      stacked.match(
        { tagId: "audio.harassment", confidence: "high" },
        { tagId: "audio.harassment", confidence: "medium" },
      ),
    ).toBe(true);
  });
});

describe("combineStrategies", () => {
  it("matches only when ALL strategies agree", () => {
    const stacked = combineStrategies(
      fuzzyMatch({ distance: 1 }),
      confidentMatch({ minConfidence: "medium" }),
    );
    const a: MatchableTag = { tagId: "audio.harassment", confidence: "high" };
    const b: MatchableTag = { tagId: "audio.harasment", confidence: "medium" };
    expect(stacked.match(a, b)).toBe(true);

    const c: MatchableTag = { tagId: "audio.harassment", confidence: "low" };
    expect(stacked.match(c, b)).toBe(false); // confidence fails
  });

  it("returns strictMatch when called with no strategies", () => {
    const s = combineStrategies();
    expect(s.name).toBe("strict");
  });
});

describe("tagsMatchWith", () => {
  it("delegates to the strategy", () => {
    const a: MatchableTag = { tagId: "x.y" };
    const b: MatchableTag = { tagId: "x.y" };
    expect(tagsMatchWith(a, b)).toBe(true);
    expect(tagsMatchWith(a, b, looseMatch)).toBe(true);
  });
});

describe("tagPrecisionRecall — strategy-aware", () => {
  it("default behavior is byte-for-byte equivalent to pre-strategy releases", () => {
    const result = tagPrecisionRecall([
      {
        entityId: "e1",
        expected: [{ tagId: "audio.harassment" }],
        predicted: [{ tagId: "audio.harassment" }],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.precision).toBe(1);
    expect(result[0]?.recall).toBe(1);
    expect(result[0]?.f1).toBe(1);
  });

  it("looseMatch lets a touching segment count as TP", () => {
    const entities = [
      {
        entityId: "e1",
        expected: [
          {
            tagId: "audio.harassment",
            scope: { modality: "audio", segment: { start: 0, end: 10 } },
          },
        ],
        predicted: [
          {
            tagId: "audio.harassment",
            scope: { modality: "audio", segment: { start: 10, end: 20 } },
          },
        ],
      },
    ];
    const strict = tagPrecisionRecall(entities);
    expect(strict[0]?.truePositives).toBe(0); // strict does not match
    expect(strict[0]?.falsePositives).toBe(1);

    const loose = tagPrecisionRecall(entities, looseMatch);
    expect(loose[0]?.truePositives).toBe(1); // loose matches
    expect(loose[0]?.falsePositives).toBe(0);
  });

  it("fuzzyMatch credits a typo'd predicted as TP against the canonical expected", () => {
    const entities = [
      {
        entityId: "e1",
        expected: [{ tagId: "audio.harassment" }],
        predicted: [{ tagId: "audio.harasment" }], // typo
      },
    ];
    const strict = tagPrecisionRecall(entities);
    expect(strict.find((r) => r.tagId === "audio.harassment")?.falseNegatives).toBe(1);

    const fuzzy = tagPrecisionRecall(entities, fuzzyMatch({ distance: 1 }));
    // The TP is keyed under the *predicted* tagId; "audio.harasment" gets the credit.
    expect(fuzzy.find((r) => r.tagId === "audio.harasment")?.truePositives).toBe(1);
  });

  it("confidentMatch composed with strictMatch lets low-confidence expected slip through as FP/FN", () => {
    const entities = [
      {
        entityId: "e1",
        expected: [{ tagId: "audio.harassment", confidence: "low" as const }],
        predicted: [{ tagId: "audio.harassment" }],
      },
    ];
    const strategy = combineStrategies(strictMatch, confidentMatch({ minConfidence: "medium" }));
    const result = tagPrecisionRecall(entities, strategy);
    expect(result[0]?.truePositives).toBe(0);
    expect(result[0]?.falsePositives).toBe(1);
    expect(result[0]?.falseNegatives).toBe(1);
  });
});
