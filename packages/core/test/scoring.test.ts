import { describe, expect, it } from "vitest";
import { binaryAgreement, tagPrecisionRecall, type TaggedEntity } from "../src/scoring.js";

describe("tagPrecisionRecall", () => {
  it("perfect agreement: precision = recall = f1 = 1", () => {
    const entities: TaggedEntity[] = [
      {
        entityId: "e1",
        expected: [{ tagId: "tox" }],
        predicted: [{ tagId: "tox" }],
      },
      {
        entityId: "e2",
        expected: [{ tagId: "tox" }],
        predicted: [{ tagId: "tox" }],
      },
    ];
    const results = tagPrecisionRecall(entities);
    const tox = results.find((r) => r.tagId === "tox");
    expect(tox?.precision).toBe(1);
    expect(tox?.recall).toBe(1);
    expect(tox?.f1).toBe(1);
    expect(tox?.samples).toBe(2);
  });

  it("over-flagging: precision drops, recall holds", () => {
    const entities: TaggedEntity[] = [
      {
        entityId: "e1",
        expected: [{ tagId: "tox" }],
        predicted: [{ tagId: "tox" }],
      },
      {
        entityId: "e2",
        expected: [],
        predicted: [{ tagId: "tox" }], // false positive
      },
      {
        entityId: "e3",
        expected: [],
        predicted: [{ tagId: "tox" }], // false positive
      },
    ];
    const results = tagPrecisionRecall(entities);
    const tox = results.find((r) => r.tagId === "tox");
    expect(tox?.truePositives).toBe(1);
    expect(tox?.falsePositives).toBe(2);
    expect(tox?.precision).toBeCloseTo(1 / 3, 6);
    expect(tox?.recall).toBe(1);
  });

  it("under-flagging: recall drops, precision holds", () => {
    const entities: TaggedEntity[] = [
      {
        entityId: "e1",
        expected: [{ tagId: "tox" }],
        predicted: [{ tagId: "tox" }],
      },
      {
        entityId: "e2",
        expected: [{ tagId: "tox" }], // false negative
        predicted: [],
      },
    ];
    const results = tagPrecisionRecall(entities);
    const tox = results.find((r) => r.tagId === "tox");
    expect(tox?.precision).toBe(1);
    expect(tox?.recall).toBe(0.5);
  });

  it("scope-aware matching: tagId match but disjoint scope counts as FP+FN, not TP", () => {
    const entities: TaggedEntity[] = [
      {
        entityId: "e1",
        expected: [
          {
            tagId: "audio.harassment",
            scope: { modality: "audio", segment: { start: 0, end: 10 } },
          },
        ],
        predicted: [
          // Same tagId, but disjoint segment — different evidence, not a match.
          {
            tagId: "audio.harassment",
            scope: { modality: "audio", segment: { start: 100, end: 110 } },
          },
        ],
      },
    ];
    const results = tagPrecisionRecall(entities);
    const tag = results.find((r) => r.tagId === "audio.harassment");
    expect(tag?.truePositives).toBe(0);
    expect(tag?.falsePositives).toBe(1);
    expect(tag?.falseNegatives).toBe(1);
  });

  it("each expected slot consumed at most once — duplicate predictions don't double-count", () => {
    const entities: TaggedEntity[] = [
      {
        entityId: "e1",
        expected: [{ tagId: "tox" }],
        predicted: [
          { tagId: "tox" }, // matches the only expected
          { tagId: "tox" }, // no expected left → FP
        ],
      },
    ];
    const results = tagPrecisionRecall(entities);
    const tox = results.find((r) => r.tagId === "tox");
    expect(tox?.truePositives).toBe(1);
    expect(tox?.falsePositives).toBe(1);
    expect(tox?.falseNegatives).toBe(0);
  });

  it("returns one row per tagId across the dataset, sorted alphabetically", () => {
    const entities: TaggedEntity[] = [
      {
        entityId: "e1",
        expected: [{ tagId: "z-tag" }],
        predicted: [{ tagId: "z-tag" }, { tagId: "a-tag" }],
      },
    ];
    const results = tagPrecisionRecall(entities);
    expect(results.map((r) => r.tagId)).toEqual(["a-tag", "z-tag"]);
  });

  it("returns empty array on empty input (no NaN leaks)", () => {
    expect(tagPrecisionRecall([])).toEqual([]);
  });
});

describe("binaryAgreement", () => {
  it("computes the same metrics from pre-bucketed boolean samples", () => {
    const r = binaryAgreement("tag", [
      { expected: true, predicted: true },
      { expected: true, predicted: true },
      { expected: false, predicted: true }, // FP
      { expected: true, predicted: false }, // FN
    ]);
    expect(r.truePositives).toBe(2);
    expect(r.falsePositives).toBe(1);
    expect(r.falseNegatives).toBe(1);
    expect(r.precision).toBeCloseTo(2 / 3, 6);
    expect(r.recall).toBeCloseTo(2 / 3, 6);
    expect(r.f1).toBeCloseTo(2 / 3, 6);
  });

  it("returns zeros (not NaN) on empty / all-true-negative input", () => {
    const empty = binaryAgreement("tag", []);
    expect(empty.precision).toBe(0);
    expect(empty.recall).toBe(0);
    expect(empty.f1).toBe(0);
    expect(empty.samples).toBe(0);
  });
});
