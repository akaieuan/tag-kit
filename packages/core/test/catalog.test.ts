import { describe, expect, it, vi } from "vitest";
import {
  defineCatalog,
  filterByModality,
  findEntry,
  groupByCategory,
  validateCatalog,
  type CustomCatalogRule,
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

describe("validateCatalog", () => {
  it("returns ok=true for a valid catalog with no findings", () => {
    const result = validateCatalog(sample);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.all).toHaveLength(0);
  });

  it("returns ok=false with all built-in errors aggregated, no throw", () => {
    const result = validateCatalog([
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
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain("EMPTY_TAG_ID");
    expect(result.errors.map((e) => e.code)).toContain("INVALID_TAG_ID_CHARS");
  });

  it("applies custom rules after built-ins", () => {
    const requirePrefix: CustomCatalogRule = {
      code: "TAGID_PREFIX",
      validate: (e) => (e.tagId.startsWith("text.") ? null : "must start with text."),
    };
    const result = validateCatalog([sample[0]!, sample[1]!], { rules: [requirePrefix] });
    expect(result.ok).toBe(false);
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain("TAGID_PREFIX");
    // The first entry "text.toxic" passes; the second "image.nsfw" fails.
    const prefixError = result.errors.find((e) => e.code === "TAGID_PREFIX");
    expect(prefixError?.tagId).toBe("image.nsfw");
  });

  it("respects custom rule severity (warn does not block ok)", () => {
    // Rule fires on entries that are otherwise valid — emits warnings only.
    const softCheck: CustomCatalogRule = {
      code: "TAGID_HAS_DOT",
      severity: "warn",
      validate: (e) => (e.tagId.includes(".") ? null : "consider using <modality>.<category>"),
    };
    // Use a sample that triggers the warning on at least one entry.
    const mixed = [
      sample[0]!, // text.toxic — passes the rule
      {
        tagId: "loose-id",
        displayName: "Loose",
        description: "no dot",
        applicableModalities: [] as readonly string[],
        severity: "info" as const,
        group: "Misc",
        supportsSegmentScope: false,
        supportsSpanScope: false,
      },
    ];
    const result = validateCatalog(mixed, { rules: [softCheck] });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]?.code).toBe("TAGID_HAS_DOT");
    expect(result.warnings[0]?.tagId).toBe("loose-id");
  });

  it("supports rule callbacks returning explicit { message, severity }", () => {
    const escalating: CustomCatalogRule = {
      code: "ESCALATING",
      severity: "warn",
      validate: (e) =>
        e.tagId.includes("danger") ? { message: "tag uses 'danger'", severity: "error" } : null,
    };
    const result = validateCatalog(
      [
        {
          tagId: "text.danger",
          displayName: "X",
          description: "X",
          applicableModalities: [],
          severity: "info",
          group: "G",
          supportsSegmentScope: false,
          supportsSpanScope: false,
        },
      ],
      { rules: [escalating] },
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("ESCALATING");
    expect(result.errors[0]?.severity).toBe("error");
  });
});

describe("defineCatalog with options", () => {
  it("severity: 'warn' never throws — emits console.warn for each finding", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = defineCatalog(
        [
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
        ],
        { severity: "warn" },
      );
      expect(result).toHaveLength(1); // returned as-is, despite the error
      expect(warnSpy).toHaveBeenCalled();
      const calls = warnSpy.mock.calls.map((c) => c[0]);
      expect(calls.some((m) => String(m).includes("EMPTY_TAG_ID"))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("strict mode (default) still throws on errors but emits warnings", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const softWarning: CustomCatalogRule = {
      code: "SOFT",
      severity: "warn",
      validate: () => "soft warning",
    };
    try {
      // No errors → no throw, but warnings should hit console.warn.
      defineCatalog(sample, { rules: [softWarning] });
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("custom rules participate in strict-mode throw", () => {
    const requirePrefix: CustomCatalogRule = {
      code: "TAGID_PREFIX",
      validate: (e) => (e.tagId.startsWith("text.") ? null : "must start with text."),
    };
    expect(() =>
      defineCatalog(
        [
          {
            tagId: "image.nsfw",
            displayName: "X",
            description: "X",
            applicableModalities: [],
            severity: "info",
            group: "G",
            supportsSegmentScope: false,
            supportsSpanScope: false,
          },
        ],
        { rules: [requirePrefix] },
      ),
    ).toThrowError(/TAGID_PREFIX/);
  });
});
