import { describe, expect, it } from "vitest";
import { scopeOverlaps, tagsMatch } from "../src/matching.js";

describe("scopeOverlaps", () => {
  it("two whole-entity scopes match", () => {
    expect(scopeOverlaps(undefined, undefined)).toBe(true);
    expect(scopeOverlaps({}, {})).toBe(true);
  });

  it("one whole-entity + one specific scope match (broader contains narrower)", () => {
    expect(scopeOverlaps(undefined, { modality: "audio" })).toBe(true);
    expect(scopeOverlaps({ modality: "audio" }, undefined)).toBe(true);
  });

  it("different modality is a hard no", () => {
    expect(scopeOverlaps({ modality: "audio" }, { modality: "video" })).toBe(false);
  });

  it("different assetId is a hard no", () => {
    expect(
      scopeOverlaps(
        { modality: "image", assetId: "asset-1" },
        { modality: "image", assetId: "asset-2" },
      ),
    ).toBe(false);
  });

  it("same modality + same assetId + segment ranges overlap → match", () => {
    expect(
      scopeOverlaps(
        { modality: "audio", segment: { start: 10, end: 20 } },
        { modality: "audio", segment: { start: 15, end: 25 } },
      ),
    ).toBe(true);
  });

  it("same modality + same assetId + segments disjoint → no match", () => {
    expect(
      scopeOverlaps(
        { modality: "audio", segment: { start: 10, end: 20 } },
        { modality: "audio", segment: { start: 30, end: 40 } },
      ),
    ).toBe(false);
  });

  it("same modality + one has segment + other doesn't → match (broader contains narrower)", () => {
    expect(
      scopeOverlaps(
        { modality: "audio", segment: { start: 10, end: 20 } },
        { modality: "audio" },
      ),
    ).toBe(true);
  });

  it("span ranges follow same overlap rules as segments", () => {
    expect(
      scopeOverlaps(
        { modality: "text", span: { start: 0, end: 50 } },
        { modality: "text", span: { start: 25, end: 75 } },
      ),
    ).toBe(true);
    expect(
      scopeOverlaps(
        { modality: "text", span: { start: 0, end: 10 } },
        { modality: "text", span: { start: 100, end: 200 } },
      ),
    ).toBe(false);
  });

  it("segment touching at boundary does NOT overlap (half-open intervals)", () => {
    // [10, 20) and [20, 30) share no points
    expect(
      scopeOverlaps(
        { modality: "audio", segment: { start: 10, end: 20 } },
        { modality: "audio", segment: { start: 20, end: 30 } },
      ),
    ).toBe(false);
  });
});

describe("tagsMatch", () => {
  it("different tagIds never match regardless of scope", () => {
    expect(
      tagsMatch({ tagId: "a" }, { tagId: "b" }),
    ).toBe(false);
  });

  it("same tagId + overlapping scope match", () => {
    expect(
      tagsMatch(
        { tagId: "audio.harassment", scope: { modality: "audio", segment: { start: 0, end: 30 } } },
        { tagId: "audio.harassment", scope: { modality: "audio", segment: { start: 15, end: 45 } } },
      ),
    ).toBe(true);
  });

  it("same tagId + disjoint scope do NOT match", () => {
    expect(
      tagsMatch(
        { tagId: "audio.harassment", scope: { modality: "audio", segment: { start: 0, end: 10 } } },
        { tagId: "audio.harassment", scope: { modality: "audio", segment: { start: 100, end: 110 } } },
      ),
    ).toBe(false);
  });

  it("same tagId + both undefined scopes match", () => {
    expect(
      tagsMatch({ tagId: "cross-modal.satire-flag" }, { tagId: "cross-modal.satire-flag" }),
    ).toBe(true);
  });
});
