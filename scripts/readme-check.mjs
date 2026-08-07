#!/usr/bin/env node
// @ts-check
/**
 * README-RUNS (`pnpm check:readme`)
 * ---------------------------------
 * Typechecks the code examples in the README(s) against the *built* public
 * types, so a doc example that no longer compiles fails CI instead of shipping.
 *
 * ── Fence convention (explicit annotation, never inference) ───────────────────
 * A fenced code block is typechecked ONLY when its info string carries the
 * `check` token:
 *
 *     ```ts check          ← typechecked as a standalone .ts module
 *     ```tsx check         ← typechecked as a standalone .tsx module (react-jsx)
 *
 * Everything else is skipped on purpose:
 *   - ```ts / ```tsx WITHOUT `check`  → skipped (a snippet not meant to compile
 *                                        in isolation, e.g. a fragment or pseudo-code)
 *   - ```bash / ```json / ``` (plain) → skipped (not TypeScript)
 *
 * We never *infer* checkability from the language alone — annotation is explicit
 * so authors can show intentionally-partial fragments without the harness
 * failing on them. Each `check` block is compiled as its own module, so it must
 * be self-contained (its own imports + declarations).
 *
 * Types resolve to each package's dist via tsconfig `paths` (built first), under
 * the same strict settings the packages ship with (strict, verbatimModuleSyntax,
 * noUncheckedIndexedAccess), so the examples are checked the way a strict
 * consumer would experience them. Cross-resolution (node16 vs bundler) is the
 * publish-smoke harness's job; this one guards the source-level examples.
 *
 * Node-only; no new runtime deps. Exits non-zero if any `check` block fails tsc.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORK = join(ROOT, ".readme-check");

/**
 * READMEs that MUST exist. This list is deliberately declared rather than
 * discovered, and deliberately NOT filtered by `existsSync`.
 *
 * The earlier version of this file listed only the root README and filtered
 * the list by existence, which meant a missing README produced a shorter
 * work-list rather than a failure — and an empty work-list is indistinguishable
 * from a satisfied one. Both packages shipped to npm at 0.3.0 with no README,
 * so their registry pages rendered "ERROR: No README data found!" while this
 * check reported success. A checker that filters its own inputs by existence
 * cannot report absence; see research note № 007.
 *
 * Every published package needs one: npm snapshots the README at publish time,
 * so a package without one has a blank registry page until the next version.
 */
const REQUIRED_READMES = [
  "README.md",
  "packages/core/README.md",
  "packages/ui/README.md",
];

const missingReadmes = REQUIRED_READMES.filter((p) => !existsSync(join(ROOT, p)));
if (missingReadmes.length > 0) {
  console.error(
    `\n[readme] ✗ ${missingReadmes.length} required README(s) missing:\n` +
      missingReadmes.map((p) => `    ${p}`).join("\n") +
      "\n\n[readme] Every published package needs a README — npm snapshots it at\n" +
      "[readme] publish time, so a package without one has a blank registry page\n" +
      "[readme] until the next version bump. Add the file, or remove it from\n" +
      "[readme] REQUIRED_READMES in scripts/readme-check.mjs if the package is private.\n",
  );
  process.exit(1);
}

const READMES = REQUIRED_READMES.map((p) => join(ROOT, p));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });
  if (r.status !== 0) {
    console.error(`\n[readme] \`${cmd} ${args.join(" ")}\` failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
  return r;
}

/**
 * Parse fenced code blocks. Returns { lang, info, body, line } for each.
 * @param {string} md
 */
function parseFences(md) {
  const lines = md.split("\n");
  /** @type {{lang:string, info:string, body:string, line:number}[]} */
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const open = /^```(\S*)(.*)$/.exec(lines[i]);
    if (open) {
      const lang = open[1] ?? "";
      const info = (open[2] ?? "").trim();
      const startLine = i + 1;
      const bodyLines = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        bodyLines.push(lines[i]);
        i++;
      }
      blocks.push({ lang, info, body: bodyLines.join("\n"), line: startLine });
    }
    i++;
  }
  return blocks;
}

function hasCheckToken(info) {
  return info.split(/\s+/).filter(Boolean).includes("check");
}

// ── Collect check blocks ──────────────────────────────────────────────────────
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

/** @type {{file:string, tsFile:string, lang:string, line:number}[]} */
const checked = [];
/** @type {{file:string, lang:string, line:number, reason:string}[]} */
const skipped = [];
let blockIndex = 0;

for (const readme of READMES) {
  const rel = relative(ROOT, readme);
  const blocks = parseFences(readFileSync(readme, "utf8"));
  for (const b of blocks) {
    const isTs = b.lang === "ts" || b.lang === "tsx" || b.lang === "typescript";
    if (isTs && hasCheckToken(b.info)) {
      const ext = b.lang === "tsx" ? "tsx" : "ts";
      const base = `${rel.replace(/[^\w]+/g, "_")}__L${b.line}__${blockIndex++}.${ext}`;
      const tsFile = join(WORK, base);
      // Prefix with a line directive comment so tsc errors point back at the README.
      writeFileSync(
        tsFile,
        `// from ${rel}:${b.line} (fenced \`${b.lang} ${b.info}\`)\n${b.body}\n`,
      );
      checked.push({ file: rel, tsFile: base, lang: b.lang, line: b.line });
    } else if (isTs) {
      skipped.push({ file: rel, lang: b.lang, line: b.line, reason: "no `check` token" });
    } else {
      skipped.push({
        file: rel,
        lang: b.lang || "(plain)",
        line: b.line,
        reason: "not TypeScript",
      });
    }
  }
}

console.log(`[readme] scanned ${READMES.length} README(s)`);
for (const c of checked) console.log(`  ✓ check  ${c.file}:${c.line}  (${c.lang})`);
for (const s of skipped) console.log(`  ·  skip  ${s.file}:${s.line}  (${s.lang}) — ${s.reason}`);

if (checked.length === 0) {
  console.log("[readme] no `check`-annotated blocks found; nothing to typecheck.");
  rmSync(WORK, { recursive: true, force: true });
  process.exit(0);
}

// ── Build packages so dist/*.d.ts exists, then write a tsconfig ───────────────
console.log("[readme] building packages for type resolution…");
run("pnpm", ["-r", "build"]);

const reactTypes = join(ROOT, "packages/ui/node_modules/@types/react");
if (!existsSync(reactTypes)) {
  console.error(`[readme] expected @types/react at ${reactTypes} — run pnpm install.`);
  process.exit(1);
}

const tsconfig = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "Bundler",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    jsx: "react-jsx",
    strict: true,
    noUncheckedIndexedAccess: true,
    esModuleInterop: true,
    skipLibCheck: true,
    verbatimModuleSyntax: true,
    forceConsistentCasingInFileNames: true,
    noEmit: true,
    types: [],
    baseUrl: ROOT,
    paths: {
      "@tag-kit/core": ["packages/core/dist/index.d.ts"],
      "@tag-kit/core/*": ["packages/core/dist/*"],
      "@tag-kit/ui": ["packages/ui/dist/index.d.ts"],
      react: ["packages/ui/node_modules/@types/react"],
      "react/*": ["packages/ui/node_modules/@types/react/*"],
      "react-dom": ["packages/ui/node_modules/@types/react-dom"],
      "react-dom/*": ["packages/ui/node_modules/@types/react-dom/*"],
    },
  },
  include: ["*.ts", "*.tsx"],
};
writeFileSync(join(WORK, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

// ── Typecheck ─────────────────────────────────────────────────────────────────
console.log(`[readme] typechecking ${checked.length} block(s)…`);
const tsc = join(ROOT, "node_modules", ".bin", "tsc");
const result = spawnSync(tsc, ["-p", join(WORK, "tsconfig.json")], {
  stdio: "inherit",
  cwd: ROOT,
});

if (result.status !== 0) {
  console.error(
    "\n[readme] ✗ a README `check` block failed to typecheck. Fix the example (or its `check` annotation) above.",
  );
  process.exit(result.status ?? 1);
}

console.log("[readme] ✓ all README `check` blocks typecheck against the built public types.");
rmSync(WORK, { recursive: true, force: true });
