import { describe, expect, it } from "vitest";
import {
  defineCatalog,
  filterByModality,
  findEntry,
  groupByCategory,
  type TagCatalogEntry,
} from "../src/catalog.js";

const sample: readonly TagCatalogEntry[] = defineCatalog([
  {
    tagId: "text.toxic",
    displayName: "Toxic",
    description: "Toxic text",
    applicableModalities: ["text"],
    severity: "warn",
    group: "Toxicity",
    supportsSegmentScope: false,
    supportsSpanScope: true,
  },
  {
    tagId: "image.nsfw",
    displayName: "NSFW",
    description: "NSFW image",
    applicableModalities: ["image"],
    severity: "danger",
    group: "Safety",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },
  {
    tagId: "context.satire-flag",
    displayName: "Satire",
    description: "Whole-event satire flag",
    applicableModalities: [], // universal — applies regardless of modality
    severity: "info",
    group: "Context",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },
]);

describe("findEntry", () => {
  it("returns the matching entry by tagId", () => {
    expect(findEntry(sample, "text.toxic")?.displayName).toBe("Toxic");
  });

  it("returns undefined for unknown ids", () => {
    expect(findEntry(sample, "nope")).toBeUndefined();
  });
});

describe("filterByModality", () => {
  it("returns entries whose applicableModalities includes the modality", () => {
    const text = filterByModality(sample, "text");
    expect(text.map((e) => e.tagId)).toEqual(["text.toxic", "context.satire-flag"]);
  });

  it("treats empty applicableModalities as universal (matches every modality)", () => {
    const audio = filterByModality(sample, "audio");
    expect(audio.map((e) => e.tagId)).toEqual(["context.satire-flag"]);
  });
});

describe("groupByCategory", () => {
  it("buckets entries into { groupName: entries[] }", () => {
    const grouped = groupByCategory(sample);
    expect(Object.keys(grouped).sort()).toEqual([
      "Context",
      "Safety",
      "Toxicity",
    ]);
    expect(grouped["Toxicity"]).toHaveLength(1);
    expect(grouped["Safety"]).toHaveLength(1);
  });
});

describe("defineCatalog", () => {
  it("is a passthrough — returns its input unchanged", () => {
    expect(defineCatalog(sample)).toBe(sample);
  });
});
