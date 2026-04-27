/**
 * @tag-kit/core — domain-agnostic tagging primitives for HITL workflows.
 *
 * Three concerns, three modules:
 *  - schema.ts    — wire shapes (TagScope, ReviewerTag, ExpectedTag, TagAgreement)
 *  - catalog.ts   — domain-defined vocabulary index + filter helpers
 *  - matching.ts  — scope-overlap rules for "did annotator A and B agree?"
 *  - scoring.ts   — per-tag precision / recall / F1 across many entities
 *
 * Bring your own catalog. Bring your own UI (or use `@tag-kit/ui`).
 * The scoring math is pure, the matching is conservative, and the schema
 * generalizes across audio, video, text, document, and code annotation.
 */

export * from "./schema.js";
export * from "./catalog.js";
export * from "./matching.js";
export * from "./scoring.js";
