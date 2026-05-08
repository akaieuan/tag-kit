import { describe, expect, it } from "vitest";
import {
  defineCatalog,
  defineNamespacedCatalog,
  mergeCatalogs,
  tag,
  type TagCatalogEntry,
} from "../src/index.js";

describe("tag builder", () => {
  it("builds a fully-defaulted minimal entry", () => {
    const entry = tag("audio.harassment").name("Audio harassment").desc("description").build();

    expect(entry).toEqual({
      tagId: "audio.harassment",
      displayName: "Audio harassment",
      description: "description",
      severity: "neutral",
      group: "Default",
      applicableModalities: [],
      supportsSegmentScope: false,
      supportsSpanScope: false,
    });
  });

  it("threads severity, group, modalities, and scope flags", () => {
    const entry = tag("audio.harassment")
      .name("Audio harassment")
      .desc("Spoken harassment, slurs, or threats.")
      .severity("danger")
      .group("Audio")
      .modalities("audio", "video")
      .segments()
      .build();

    expect(entry.severity).toBe("danger");
    expect(entry.group).toBe("Audio");
    expect(entry.applicableModalities).toEqual(["audio", "video"]);
    expect(entry.supportsSegmentScope).toBe(true);
    expect(entry.supportsSpanScope).toBe(false);
  });

  it("supports turning span scope on", () => {
    const entry = tag("text.toxic").name("Toxic").desc("Toxic text").spans().build();
    expect(entry.supportsSpanScope).toBe(true);
  });

  it("supports turning segment scope back off via segments(false)", () => {
    const entry = tag("audio.x").name("X").desc("X").segments().segments(false).build();
    expect(entry.supportsSegmentScope).toBe(false);
  });

  it("throws on missing displayName at build time (delegates to defineCatalog)", () => {
    expect(() => tag("text.toxic").desc("description-only").build()).toThrowError(
      /EMPTY_DISPLAY_NAME/,
    );
  });

  it("throws on missing description at build time", () => {
    expect(() => tag("text.toxic").name("Toxic").build()).toThrowError(/EMPTY_DESCRIPTION/);
  });

  it("throws on invalid tagId chars", () => {
    expect(() => tag("text.has space").name("X").desc("X").build()).toThrowError(
      /INVALID_TAG_ID_CHARS/,
    );
  });

  it("composes with defineCatalog at the array level", () => {
    const entries = [
      tag("text.toxic").name("Toxic").desc("Toxic text").severity("warn").group("Toxicity").build(),
      tag("image.nsfw").name("NSFW").desc("NSFW image").severity("danger").group("Safety").build(),
    ];
    const catalog = defineCatalog(entries);
    expect(catalog).toHaveLength(2);
    expect(catalog[0]?.tagId).toBe("text.toxic");
  });
});

describe("mergeCatalogs", () => {
  const A: readonly TagCatalogEntry[] = [
    {
      tagId: "text.toxic",
      displayName: "Toxic",
      description: "Toxic text",
      severity: "warn",
      group: "Toxicity",
      applicableModalities: ["text"],
      supportsSegmentScope: false,
      supportsSpanScope: true,
    },
  ];
  const B: readonly TagCatalogEntry[] = [
    {
      tagId: "image.nsfw",
      displayName: "NSFW",
      description: "NSFW image",
      severity: "danger",
      group: "Safety",
      applicableModalities: ["image"],
      supportsSegmentScope: false,
      supportsSpanScope: false,
    },
  ];

  it("concatenates input catalogs in order", () => {
    const merged = mergeCatalogs(A, B);
    expect(merged.map((e) => e.tagId)).toEqual(["text.toxic", "image.nsfw"]);
  });

  it("does not mutate inputs", () => {
    const aRef = A;
    const bRef = B;
    mergeCatalogs(A, B);
    expect(A).toBe(aRef);
    expect(B).toBe(bRef);
  });

  it("throws DUPLICATE_TAG_ID when tagIds collide across catalogs", () => {
    expect(() => mergeCatalogs(A, A)).toThrowError(/DUPLICATE_TAG_ID/);
  });

  it("supports merging three or more catalogs", () => {
    const C: readonly TagCatalogEntry[] = [
      {
        tagId: "audio.harassment",
        displayName: "Audio harassment",
        description: "Spoken harassment",
        severity: "danger",
        group: "Audio",
        applicableModalities: ["audio"],
        supportsSegmentScope: true,
        supportsSpanScope: false,
      },
    ];
    const merged = mergeCatalogs(A, B, C);
    expect(merged.map((e) => e.tagId)).toEqual(["text.toxic", "image.nsfw", "audio.harassment"]);
  });

  it("returns an empty array when called with no arguments", () => {
    const merged = mergeCatalogs();
    expect(merged).toEqual([]);
  });
});

describe("defineNamespacedCatalog", () => {
  it("validates the catalog like defineCatalog (runtime parity)", () => {
    const c = defineNamespacedCatalog(["text", "image"] as const, [
      tag("text.toxic").name("Toxic").desc("Toxic text").severity("warn").group("Toxicity").build(),
      tag("image.nsfw").name("NSFW").desc("NSFW image").severity("danger").group("Safety").build(),
    ]);
    expect(c).toHaveLength(2);
  });

  it("throws on duplicate tagId across the input", () => {
    expect(() =>
      defineNamespacedCatalog(["text"] as const, [
        tag("text.toxic").name("A").desc("A").build(),
        tag("text.toxic").name("B").desc("B").build(),
      ]),
    ).toThrowError(/DUPLICATE_TAG_ID/);
  });
});
