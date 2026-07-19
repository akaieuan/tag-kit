import { describe, it, expect } from "vitest";
import * as ui from "../src/index.js";

/**
 * API SURFACE SNAPSHOT (runtime exports) for @tag-kit/ui.
 *
 * Locks the sorted list of *runtime* export names from the package entry point.
 * A new export, a renamed export, or a removed export changes this snapshot and
 * must be reviewed on purpose. (The public *type* surface is guarded separately
 * by scripts/api-surface.mjs + api-surface/ui.d.ts.)
 *
 * Update intentionally with: pnpm --filter @tag-kit/ui test -- -u
 */
describe("@tag-kit/ui public runtime surface", () => {
  it("exports a stable, sorted set of runtime names", () => {
    const names = Object.keys(ui).sort();
    expect(names).toMatchInlineSnapshot(`
      [
        "TagChip",
        "TagFilter",
        "TagPicker",
        "TagSummary",
        "useTagFilter",
        "useTagStaging",
      ]
    `);
  });
});
