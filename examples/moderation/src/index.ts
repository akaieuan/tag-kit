/**
 * Example tag catalog for content moderation. This is what `inertial`
 * (the reference moderation app this catalog was extracted from) ships
 * as TAG_CATALOG.
 *
 * Drop it into your own moderation pipeline by importing this file or by
 * copy-pasting the entries — the catalog is plain data with stable tagIds.
 *
 * Naming convention: `<modality>.<category>` — modality is one of
 * text / image / video / audio / link / cross-modal; category is short
 * kebab-case. Cross-modal tags apply to whole events regardless of which
 * assets are attached.
 */
import { defineCatalog, type TagCatalogEntry } from "@tag-kit/core";

export type ModerationModality =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "link"
  | "cross-modal";

export type ModerationGroup =
  | "Toxicity"
  | "Privacy"
  | "Validation"
  | "Violence"
  | "Safety"
  | "Audio"
  | "Context";

export type ModerationTag = TagCatalogEntry<ModerationModality, ModerationGroup>;

export const MODERATION_TAG_CATALOG = defineCatalog<ModerationTag>([
  // --- Text ---
  {
    tagId: "text.tone-violation",
    displayName: "Toxic tone",
    description: "Hostile / demeaning tone the local classifier missed.",
    applicableModalities: ["text"],
    severity: "warn",
    group: "Toxicity",
    supportsSegmentScope: false,
    supportsSpanScope: true,
  },
  {
    tagId: "text.pii-present",
    displayName: "PII exposed",
    description: "Personally identifiable information in the text.",
    applicableModalities: ["text"],
    severity: "danger",
    group: "Privacy",
    supportsSegmentScope: false,
    supportsSpanScope: true,
  },
  {
    tagId: "text.coded-language",
    displayName: "Coded / dog-whistle",
    description: "In-group terminology invisible to local classifiers.",
    applicableModalities: ["text"],
    severity: "warn",
    group: "Toxicity",
    supportsSegmentScope: false,
    supportsSpanScope: true,
  },

  // --- Image ---
  {
    tagId: "image.benign",
    displayName: "Benign image",
    description: "Image itself contains nothing actionable.",
    applicableModalities: ["image"],
    severity: "neutral",
    group: "Validation",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },
  {
    tagId: "image.violence",
    displayName: "Visual violence",
    description: "Gore, weapons, depicted physical violence.",
    applicableModalities: ["image"],
    severity: "danger",
    group: "Violence",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },
  {
    tagId: "image.minor-present",
    displayName: "Minor present",
    description: "Identifiable presence of a minor.",
    applicableModalities: ["image"],
    severity: "danger",
    group: "Safety",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },

  // --- Video (per-segment scope; visual + audio tracks tagged separately) ---
  {
    tagId: "video.visual-benign",
    displayName: "Video visual: benign",
    description: "Visual track has no violation.",
    applicableModalities: ["video"],
    severity: "neutral",
    group: "Validation",
    supportsSegmentScope: true,
    supportsSpanScope: false,
  },
  {
    tagId: "video.visual-violation",
    displayName: "Video visual: violation",
    description: "Visual content depicts NSFW or violence.",
    applicableModalities: ["video"],
    severity: "danger",
    group: "Violence",
    supportsSegmentScope: true,
    supportsSpanScope: false,
  },
  {
    tagId: "video.audio-violation",
    displayName: "Video audio: violation",
    description: "Audio track contains violation; visual may be fine.",
    applicableModalities: ["video"],
    severity: "danger",
    group: "Audio",
    supportsSegmentScope: true,
    supportsSpanScope: false,
  },

  // --- Audio (standalone or video soundtrack) ---
  {
    tagId: "audio.harassment",
    displayName: "Audio harassment",
    description: "Spoken harassment, slurs, or threats.",
    applicableModalities: ["audio", "video"],
    severity: "danger",
    group: "Audio",
    supportsSegmentScope: true,
    supportsSpanScope: false,
  },
  {
    tagId: "audio.coded-speech",
    displayName: "Coded audio speech",
    description: "Spoken in-group / dog-whistle terminology.",
    applicableModalities: ["audio", "video"],
    severity: "warn",
    group: "Audio",
    supportsSegmentScope: true,
    supportsSpanScope: false,
  },

  // --- Cross-modal (whole-event tags) ---
  {
    tagId: "cross-modal.text-image-mismatch",
    displayName: "Text/image mismatch",
    description: "Text describes one thing; image shows another.",
    applicableModalities: [], // universal — applies to whole event regardless of modality
    severity: "warn",
    group: "Context",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },
  {
    tagId: "cross-modal.satire-flag",
    displayName: "Satire / parody",
    description: "Apparent violation is satire — label, don't remove.",
    applicableModalities: [],
    severity: "info",
    group: "Context",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },
]);
