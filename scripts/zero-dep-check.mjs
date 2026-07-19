#!/usr/bin/env node
// @ts-check
/**
 * ZERO-DEPENDENCY ENFORCEMENT (`pnpm check:zero-dep`)
 * --------------------------------------------------
 * The README claims @tag-kit/core has *zero runtime dependencies*. This makes
 * that claim machine-enforced against what npm consumers actually receive.
 *
 * Crucially it inspects the PACKED tarball's package.json — not the source one.
 * `pnpm pack` rewrites `workspace:*` specifiers to concrete versions and applies
 * the `files`/publishConfig rules, so the packed manifest is the source of truth
 * for what a consumer installs. A source package.json with `dependencies: {}`
 * could still ship a dependency if tooling injected one at pack time; this checks
 * the artifact.
 *
 * Asserts: core's packed `dependencies` is empty or absent. `optionalDependencies`
 * and `peerDependencies` are also checked to be empty/absent (a peer dep would
 * still force something onto the consumer's install graph).
 *
 * Node-only; no new runtime deps. Exits non-zero on violation.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CORE = join(ROOT, "packages/core");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    ...opts,
  });
  if (r.status !== 0) {
    console.error(`\n[zero-dep] \`${cmd} ${args.join(" ")}\` failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
  return r;
}

const packDir = mkdtempSync(join(tmpdir(), "tag-kit-zerodep-"));
try {
  console.log("[zero-dep] packing @tag-kit/core…");
  run("pnpm", ["pack", "--pack-destination", packDir], { cwd: CORE });

  const tgz = readdirSync(packDir).find((f) => f.endsWith(".tgz"));
  if (!tgz) {
    console.error("[zero-dep] no tarball produced by pnpm pack.");
    process.exit(1);
  }

  // Extract just the package.json from the tarball (tar reads the gzip directly).
  run("tar", ["-xzf", join(packDir, tgz), "-C", packDir, "package/package.json"]);
  const manifest = JSON.parse(readFileSync(join(packDir, "package", "package.json"), "utf8"));

  /** @type {string[]} */
  const violations = [];
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    const val = manifest[field];
    if (val && Object.keys(val).length > 0) {
      violations.push(`${field}: ${JSON.stringify(val)}`);
    }
  }

  if (violations.length > 0) {
    console.error(
      `\n[zero-dep] ✗ @tag-kit/core@${manifest.version} SHIPS DEPENDENCIES — the zero-dependency README claim is now false:\n  ${violations.join("\n  ")}`,
    );
    process.exit(1);
  }

  console.log(
    `[zero-dep] ✓ @tag-kit/core@${manifest.version} tarball ships no dependencies (dependencies/optional/peer all empty or absent). README claim holds.`,
  );
} finally {
  rmSync(packDir, { recursive: true, force: true });
}
