#!/usr/bin/env node
// @ts-check
/**
 * PUBLISH SMOKE (`pnpm smoke:publish`)
 * ------------------------------------
 * The check a stranger runs before depending on @tag-kit/*: does the *published
 * artifact* actually work in a fresh project OUTSIDE this monorepo? Workspace
 * symlinks, path aliases, and hoisting all hide breakage that a real consumer
 * hits. This simulates the real thing:
 *
 *   1. pnpm build         — emit dist/ for both packages.
 *   2. pnpm pack          — produce the exact tarballs npm would publish.
 *   3. Rewrite the @tag-kit/ui tarball so its `@tag-kit/core` dependency points
 *      at the LOCAL core tarball (file:) instead of the registry version — the
 *      consumer must resolve ui→core from what we just built, not from npm.
 *   4. Scratch consumer in a fresh temp dir OUTSIDE the repo (fs.mkdtemp), one
 *      per tsconfig moduleResolution mode we support — `bundler` AND `node16` —
 *      installing the tarballs via `file:` specifiers and the react peer from
 *      the real npm registry.
 *   5. Runtime: `node` imports EVERY exports subpath of core plus ui and calls
 *      2–3 real symbols, asserting behaviour.
 *   6. Types: `tsc --noEmit` imports every subpath + ui and uses real symbols,
 *      so subpath type resolution is proven under BOTH moduleResolution modes
 *      (node16 subpath resolution is stricter than bundler — this is the point).
 *   7. `@arethetypeswrong/cli --pack` on each tarball with the `esm-only`
 *      profile (justified below).
 *
 * ── attw profile justification ────────────────────────────────────────────────
 * These packages are intentionally ESM-only (`"type":"module"`, no CJS build) and
 * expose subpath `exports`. The default (strict) attw profile therefore flags two
 * families of "problems" that are expected and acceptable for this design:
 *   • `cjs-resolves-to-esm` — a CommonJS `require()` reaches ESM. Correct: CJS
 *     consumers must use dynamic `import()`. We ship no CJS on purpose.
 *   • node10 subpath resolution failures — the legacy node10 resolver predates
 *     the `exports` field and cannot see subpaths. We target node16 + bundler.
 * The `esm-only` profile ignores exactly these two and fails on everything else
 * (broken types, false ESM/CJS, unresolved entrypoints), which is what we want.
 *
 * Node-only; shells out to pnpm/npm/npx/tar. No new runtime deps in the packages.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CORE = join(ROOT, "packages/core");
const UI = join(ROOT, "packages/ui");

const REACT_RANGE = "^18.3.1"; // satisfies @tag-kit/ui peer `react: >=18`
const REACT_TYPES_RANGE = "^18.3.12";
const TS_RANGE = "^5.7.3";
const MODULE_RESOLUTIONS = /** @type {const} */ (["bundler", "node16"]);

/** @type {string[]} */
const cleanup = [];
function tmp(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  cleanup.push(d);
  return d;
}

function step(msg) {
  console.log(`\n[smoke] ${msg}`);
}

/** Run a command, inherit stdio, throw (exit) on failure. */
function run(cmd, args, opts = {}) {
  const printable = `${cmd} ${args.join(" ")}`;
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    console.error(
      `\n[smoke] ✗ \`${printable}\` failed (exit ${r.status}) in ${opts.cwd ?? process.cwd()}`,
    );
    fail();
  }
  return r;
}

function fail() {
  for (const d of cleanup) rmSync(d, { recursive: true, force: true });
  process.exit(1);
}

function pkgVersion(pkgDir) {
  return JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;
}

// ── 1. Build ──────────────────────────────────────────────────────────────────
step("building packages (pnpm -r build)…");
run("pnpm", ["-r", "build"], { cwd: ROOT });

// ── 2. Pack ───────────────────────────────────────────────────────────────────
const packDir = tmp("tag-kit-pack-");
step(`packing tarballs into ${packDir}…`);
run("pnpm", ["pack", "--pack-destination", packDir], { cwd: CORE });
run("pnpm", ["pack", "--pack-destination", packDir], { cwd: UI });

const coreVersion = pkgVersion(CORE);
const uiVersion = pkgVersion(UI);
const coreTarball = join(packDir, `tag-kit-core-${coreVersion}.tgz`);
// The pristine ui tarball (exactly what npm would publish) is what attw checks.
// A separate rewritten copy (core dep → local tarball) is what the consumer installs.
const uiTarballOriginal = join(packDir, `tag-kit-ui-${uiVersion}.tgz`);
let uiTarball = uiTarballOriginal;

// ── 3. Rewrite ui tarball: @tag-kit/core dep → the local core tarball ─────────
step("rewriting @tag-kit/ui → @tag-kit/core dependency to the local core tarball…");
{
  const extract = tmp("tag-kit-ui-rewrite-");
  run("tar", ["-xzf", uiTarballOriginal, "-C", extract]);
  const manifestPath = join(extract, "package", "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const fileSpec = `file:${coreTarball}`;
  manifest.dependencies = { ...manifest.dependencies, "@tag-kit/core": fileSpec };
  // Drop @tag-kit/core from peers — it's satisfied by the tarball dependency above;
  // a `file:` range in peerDependencies would make npm emit an unmet-peer warning.
  if (manifest.peerDependencies && "@tag-kit/core" in manifest.peerDependencies) {
    delete manifest.peerDependencies["@tag-kit/core"];
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const rewritten = join(packDir, `tag-kit-ui-${uiVersion}-rewritten.tgz`);
  run("tar", ["-czf", rewritten, "-C", extract, "package"]);
  uiTarball = rewritten;
  console.log(`[smoke] ui core-dep now → ${fileSpec}`);
}

// ── The consumer's runtime + type source (shared across resolution modes) ─────
const RUNTIME_SRC = `\
import * as root from "@tag-kit/core";
import * as schema from "@tag-kit/core/schema";
import * as catalog from "@tag-kit/core/catalog";
import * as scoring from "@tag-kit/core/scoring";
import * as matching from "@tag-kit/core/matching";
import * as builder from "@tag-kit/core/builder";
import * as strategies from "@tag-kit/core/strategies";
import * as ui from "@tag-kit/ui";
import assert from "node:assert/strict";

// Every exports subpath must produce a live namespace object.
for (const [name, mod] of Object.entries({ root, schema, catalog, scoring, matching, builder, strategies, ui })) {
  assert.ok(mod && typeof mod === "object", \`subpath "\${name}" imported no namespace\`);
}

// 2–3 real symbols, exercised for real behaviour.
const cat = root.defineCatalog([
  {
    tagId: "audio.harassment",
    displayName: "Audio harassment",
    description: "Spoken harassment.",
    applicableModalities: ["audio"],
    severity: "danger",
    group: "Audio",
    supportsSegmentScope: true,
    supportsSpanScope: false,
  },
]);
assert.equal(cat.length, 1);

const overlap = matching.tagsMatch(
  { tagId: "audio.harassment", scope: { modality: "audio", segment: { start: 0, end: 10 } } },
  { tagId: "audio.harassment", scope: { modality: "audio", segment: { start: 5, end: 15 } } },
);
assert.equal(overlap, true, "overlapping same-modality segments should match");

const scored = scoring.tagPrecisionRecall([
  { entityId: "e1", expected: [{ tagId: "audio.harassment" }], predicted: [{ tagId: "audio.harassment" }] },
]);
assert.equal(scored[0]?.f1, 1, "perfect prediction should score f1 === 1");

assert.equal(typeof ui.TagPicker, "function", "ui.TagPicker should be a component");
assert.equal(typeof ui.useTagStaging, "function", "ui.useTagStaging should be a hook");

console.log("[smoke]   runtime import + usage OK");
`;

const TYPES_SRC = `\
// tsc --noEmit usage — imports every subpath (types resolved under this
// project's moduleResolution) and uses real symbols with their types.
import type { ReviewerTag, TagScope, TagAgreement } from "@tag-kit/core/schema";
import { defineCatalog } from "@tag-kit/core/catalog";
import { tagPrecisionRecall } from "@tag-kit/core/scoring";
import { tagsMatch } from "@tag-kit/core/matching";
import { tag } from "@tag-kit/core/builder";
import { strictMatch } from "@tag-kit/core/strategies";
import * as root from "@tag-kit/core";
import { TagChip, type TagChipProps } from "@tag-kit/ui";

const _catalog = defineCatalog([
  {
    tagId: "audio.harassment",
    displayName: "Audio harassment",
    description: "Spoken harassment.",
    applicableModalities: ["audio"],
    severity: "danger",
    group: "Audio",
    supportsSegmentScope: true,
    supportsSpanScope: false,
  },
]);

const _scope: TagScope = { modality: "audio", segment: { start: 0, end: 10 } };
const _tags: ReviewerTag[] = [{ tagId: "audio.harassment", scope: _scope }];
const _built = tag("audio.harassment").name("Audio harassment").modalities("audio").build();
const _result: TagAgreement[] = tagPrecisionRecall(
  [{ entityId: "e1", expected: [{ tagId: "audio.harassment" }], predicted: _tags }],
  strictMatch,
);
const _matched: boolean = tagsMatch(_tags[0]!, { tagId: "audio.harassment" });
const _chipProps: Pick<TagChipProps, "tag"> = { tag: _tags[0]! };

// reference everything so noUnusedLocals-style checks (if any) stay quiet
export const _surface = { root, TagChip, _catalog, _built, _result, _matched, _chipProps };
`;

// ── 4–6. Consumer per moduleResolution mode ──────────────────────────────────
for (const moduleResolution of MODULE_RESOLUTIONS) {
  step(`consumer smoke — moduleResolution: ${moduleResolution}`);
  const consumer = tmp(`tag-kit-consumer-${moduleResolution}-`);

  const consumerPkg = {
    name: `tag-kit-smoke-${moduleResolution}`,
    version: "0.0.0",
    private: true,
    type: "module",
    dependencies: {
      "@tag-kit/core": `file:${coreTarball}`,
      "@tag-kit/ui": `file:${uiTarball}`,
      react: REACT_RANGE,
    },
    devDependencies: {
      typescript: TS_RANGE,
      "@types/react": REACT_TYPES_RANGE,
    },
  };
  writeFileSync(join(consumer, "package.json"), JSON.stringify(consumerPkg, null, 2));

  // node16 requires `module: node16`; bundler pairs with a modern `module`.
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: moduleResolution === "node16" ? "node16" : "ESNext",
      moduleResolution,
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      jsx: "react-jsx",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
      types: [],
    },
    include: ["usage.ts"],
  };
  writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
  writeFileSync(join(consumer, "runtime.mjs"), RUNTIME_SRC);
  writeFileSync(join(consumer, "usage.ts"), TYPES_SRC);

  step(`  installing tarballs + react peer from npm (${moduleResolution})…`);
  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel", "error"], { cwd: consumer });

  step(`  runtime import + usage (node) [${moduleResolution}]`);
  run("node", ["runtime.mjs"], { cwd: consumer });

  step(`  tsc --noEmit usage of real symbols [moduleResolution: ${moduleResolution}]`);
  run(join(consumer, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.json"], { cwd: consumer });
  console.log(`[smoke]   ✓ ${moduleResolution} consumer clean (runtime + types)`);
}

// ── 7. arethetypeswrong per tarball ───────────────────────────────────────────
for (const [label, tarball] of [
  ["@tag-kit/core", coreTarball],
  ["@tag-kit/ui", uiTarballOriginal],
]) {
  step(`arethetypeswrong --pack ${label} (profile esm-only)…`);
  run(
    "npx",
    ["--yes", "@arethetypeswrong/cli@latest", "--pack", tarball, "--profile", "esm-only"],
    {
      cwd: ROOT,
    },
  );
  console.log(`[smoke]   ✓ ${label} types resolve cleanly (esm-only profile)`);
}

// ── Done ──────────────────────────────────────────────────────────────────────
for (const d of cleanup) rmSync(d, { recursive: true, force: true });
console.log(
  "\n[smoke] ✓ PUBLISH SMOKE PASSED — packed artifacts install, import, typecheck (bundler + node16), and pass attw outside the monorepo.",
);
