import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTagFilter } from "../src/useTagFilter.js";
import type { ReviewerTag, TagCatalogEntry } from "@tag-kit/core";

const CATALOG: readonly TagCatalogEntry[] = [
  {
    tagId: "text.toxic",
    displayName: "Toxic text",
    description: "Hostile or demeaning text content.",
    applicableModalities: ["text"],
    severity: "warn",
    group: "Toxicity",
    supportsSegmentScope: false,
    supportsSpanScope: true,
  },
  {
    tagId: "image.nsfw",
    displayName: "NSFW image",
    description: "Adult or graphic image content.",
    applicableModalities: ["image"],
    severity: "danger",
    group: "Safety",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },
  {
    tagId: "audio.harassment",
    displayName: "Audio harassment",
    description: "Spoken slurs.",
    applicableModalities: ["audio"],
    severity: "danger",
    group: "Audio",
    supportsSegmentScope: true,
    supportsSpanScope: false,
  },
];

const TAGS: readonly ReviewerTag[] = [
  { tagId: "text.toxic" },
  { tagId: "image.nsfw" },
  { tagId: "audio.harassment", note: "harasser names target" },
];

describe("useTagFilter", () => {
  it("returns all tags when no filters are set", () => {
    const { result } = renderHook(() => useTagFilter(TAGS, {}, CATALOG));
    expect(result.current).toHaveLength(3);
  });

  it("filters by modality (catalog-aware)", () => {
    const { result } = renderHook(() => useTagFilter(TAGS, { modality: "text" }, CATALOG));
    expect(result.current.map((t) => t.tagId)).toEqual(["text.toxic"]);
  });

  it("filters by severity", () => {
    const { result } = renderHook(() => useTagFilter(TAGS, { severity: ["danger"] }, CATALOG));
    expect(result.current.map((t) => t.tagId)).toEqual(["image.nsfw", "audio.harassment"]);
  });

  it("filters by group", () => {
    const { result } = renderHook(() => useTagFilter(TAGS, { group: ["Audio"] }, CATALOG));
    expect(result.current.map((t) => t.tagId)).toEqual(["audio.harassment"]);
  });

  it("filters by free-text query against tagId, displayName, description, and note", () => {
    const queryDisplayName = renderHook(() => useTagFilter(TAGS, { query: "NSFW" }, CATALOG));
    expect(queryDisplayName.result.current.map((t) => t.tagId)).toEqual(["image.nsfw"]);

    const queryNote = renderHook(() => useTagFilter(TAGS, { query: "harasser names" }, CATALOG));
    expect(queryNote.result.current.map((t) => t.tagId)).toEqual(["audio.harassment"]);

    const queryDescription = renderHook(() =>
      useTagFilter(TAGS, { query: "Adult or graphic" }, CATALOG),
    );
    expect(queryDescription.result.current.map((t) => t.tagId)).toEqual(["image.nsfw"]);
  });

  it("composes multiple filters with AND semantics", () => {
    const { result } = renderHook(() =>
      useTagFilter(TAGS, { severity: ["danger"], group: ["Safety"] }, CATALOG),
    );
    expect(result.current.map((t) => t.tagId)).toEqual(["image.nsfw"]);
  });

  it("keeps tags without a catalog entry — only the query filter applies to them", () => {
    const tags: readonly ReviewerTag[] = [{ tagId: "unknown.tag" }];
    const passes = renderHook(() => useTagFilter(tags, { query: "unknown" }, CATALOG));
    expect(passes.result.current).toHaveLength(1);
    const fails = renderHook(() => useTagFilter(tags, { query: "no match" }, CATALOG));
    expect(fails.result.current).toHaveLength(0);
  });

  it("works without a catalog (query-only filter)", () => {
    const { result } = renderHook(() => useTagFilter(TAGS, { query: "audio" }));
    expect(result.current.map((t) => t.tagId)).toEqual(["audio.harassment"]);
  });
});
