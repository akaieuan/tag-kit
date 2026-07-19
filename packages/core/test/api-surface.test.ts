import { describe, it, expect } from "vitest";
import * as core from "../src/index.js";

/**
 * API SURFACE SNAPSHOT (runtime exports) for @tag-kit/core.
 *
 * Locks the sorted list of *runtime* export names from the package entry point.
 * A new export, a renamed export, or a removed export changes this snapshot and
 * must be reviewed on purpose. (The public *type* surface is guarded separately
 * by scripts/api-surface.mjs + api-surface/core.d.ts.)
 *
 * Update intentionally with: pnpm --filter @tag-kit/core test -- -u
 */
describe("@tag-kit/core public runtime surface", () => {
  it("exports a stable, sorted set of runtime names", () => {
    const names = Object.keys(core).sort();
    expect(names).toMatchInlineSnapshot(`
      [
        "binaryAgreement",
        "combineStrategies",
        "confidentMatch",
        "defineCatalog",
        "defineNamespacedCatalog",
        "filterByModality",
        "findEntry",
        "fuzzyMatch",
        "groupByCategory",
        "looseMatch",
        "mergeCatalogs",
        "scopeOverlaps",
        "strictMatch",
        "tag",
        "tagPrecisionRecall",
        "tagsMatch",
        "tagsMatchWith",
        "validateCatalog",
      ]
    `);
  });
});
