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
    expect(Object.keys(grouped).sort()).toEqual(["Context", "Safety", "Toxicity"]);
    expect(grouped["Toxicity"]).toHaveLength(1);
    expect(grouped["Safety"]).toHaveLength(1);
  });
});

describe("defineCatalog", () => {
  it("returns the input unchanged when valid", () => {
    expect(defineCatalog(sample)).toBe(sample);
  });

  it("throws on duplicate tagId, naming both indices in the message", () => {
    expect(() =>
      defineCatalog([
        {
          tagId: "text.toxic",
          displayName: "Toxic 1",
          description: "first",
          applicableModalities: ["text"],
          severity: "warn",
          group: "Toxicity",
          supportsSegmentScope: false,
          supportsSpanScope: true,
        },
        {
          tagId: "text.toxic",
          displayName: "Toxic 2",
          description: "duplicate",
          applicableModalities: ["text"],
          severity: "warn",
          group: "Toxicity",
          supportsSegmentScope: false,
          supportsSpanScope: true,
        },
      ]),
    ).toThrowError(/DUPLICATE_TAG_ID.*duplicates entry at index 0/s);
  });

  it("throws on empty tagId", () => {
    expect(() =>
      defineCatalog([
        {
          tagId: "",
          displayName: "x",
          description: "x",
          applicableModalities: [],
          severity: "info",
          group: "G",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
      ]),
    ).toThrowError(/EMPTY_TAG_ID/);
  });

  it("throws on whitespace-only tagId", () => {
    expect(() =>
      defineCatalog([
        {
          tagId: "   ",
          displayName: "x",
          description: "x",
          applicableModalities: [],
          severity: "info",
          group: "G",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
      ]),
    ).toThrowError(/EMPTY_TAG_ID/);
  });

  it("throws on tagId containing whitespace or other invalid characters", () => {
    expect(() =>
      defineCatalog([
        {
          tagId: "text.has space",
          displayName: "x",
          description: "x",
          applicableModalities: [],
          severity: "info",
          group: "G",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
      ]),
    ).toThrowError(/INVALID_TAG_ID_CHARS/);

    expect(() =>
      defineCatalog([
        {
          tagId: "text/slash",
          displayName: "x",
          description: "x",
          applicableModalities: [],
          severity: "info",
          group: "G",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
      ]),
    ).toThrowError(/INVALID_TAG_ID_CHARS/);
  });

  it("throws on empty displayName, description, or group", () => {
    expect(() =>
      defineCatalog([
        {
          tagId: "x.y",
          displayName: "",
          description: "x",
          applicableModalities: [],
          severity: "info",
          group: "G",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
      ]),
    ).toThrowError(/EMPTY_DISPLAY_NAME/);

    expect(() =>
      defineCatalog([
        {
          tagId: "x.y",
          displayName: "x",
          description: "  ",
          applicableModalities: [],
          severity: "info",
          group: "G",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
      ]),
    ).toThrowError(/EMPTY_DESCRIPTION/);

    expect(() =>
      defineCatalog([
        {
          tagId: "x.y",
          displayName: "x",
          description: "x",
          applicableModalities: [],
          severity: "info",
          group: "",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
      ]),
    ).toThrowError(/EMPTY_GROUP/);
  });

  it("aggregates multiple errors in a single throw", () => {
    let caught: Error | undefined;
    try {
      defineCatalog([
        {
          tagId: "",
          displayName: "",
          description: "x",
          applicableModalities: [],
          severity: "info",
          group: "G",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
        {
          tagId: "good.id",
          displayName: "x",
          description: "x",
          applicableModalities: [],
          severity: "info",
          group: "",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
        {
          tagId: "bad id",
          displayName: "x",
          description: "x",
          applicableModalities: [],
          severity: "info",
          group: "G",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
      ]);
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    const msg = caught!.message;
    expect(msg).toMatch(/EMPTY_TAG_ID/);
    expect(msg).toMatch(/EMPTY_DISPLAY_NAME/);
    expect(msg).toMatch(/EMPTY_GROUP/);
    expect(msg).toMatch(/INVALID_TAG_ID_CHARS/);
    expect(msg).toMatch(/4 invalid entries/);
  });
});
