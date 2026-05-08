import { useCallback, useMemo, useRef, useState } from "react";
import type { ReviewerTag } from "@tag-kit/core";

export interface UseTagStagingOptions {
  /** Initial set of staged tags. Used only on first render — subsequent
   *  changes flow through the returned `stage` / `unstage` / `clear`. */
  initial?: readonly ReviewerTag[];
  /** Optional callback fired on every change (useful for persistence /
   *  controlled-form patterns). Receives the new staged array. */
  onChange?: (next: readonly ReviewerTag[]) => void;
}

export interface UseTagStagingReturn {
  staged: readonly ReviewerTag[];
  /** Add a tag. No-op if a tag with the same `tagId` is already staged
   *  (matches the TagPicker's "disable already-staged" semantics). */
  stage: (tag: ReviewerTag) => void;
  /** Remove the staged tag with the matching `tagId`. */
  unstage: (tagId: string) => void;
  /** Replace the staged set wholesale. */
  setStaged: (next: readonly ReviewerTag[]) => void;
  /** Remove every staged tag. */
  clear: () => void;
  /** True iff a tag with this `tagId` is currently staged. */
  has: (tagId: string) => boolean;
}

/**
 * Manages the staged-tag state most consumers roll themselves around
 * `<TagPicker />`. Pairs with `staged={staged}` and
 * `onPick={stage}`/`onRemove={() => unstage(tag.tagId)}`.
 *
 *     const { staged, stage, unstage, has, clear } = useTagStaging();
 *     return (
 *       <>
 *         <TagPicker catalog={C} staged={staged} modality="text" onPick={stage} />
 *         {staged.map((t) => (
 *           <TagChip
 *             key={t.tagId}
 *             tag={t}
 *             entry={C.find((e) => e.tagId === t.tagId)}
 *             onRemove={() => unstage(t.tagId)}
 *           />
 *         ))}
 *       </>
 *     );
 */
export function useTagStaging(options?: UseTagStagingOptions): UseTagStagingReturn {
  const initial = options?.initial ?? [];
  const [staged, setStagedInternal] = useState<readonly ReviewerTag[]>(initial);

  // Keep onChange in a ref so referential changes to the callback don't
  // re-bind the imperative helpers below.
  const onChangeRef = useRef(options?.onChange);
  onChangeRef.current = options?.onChange;

  const apply = useCallback((next: readonly ReviewerTag[]) => {
    setStagedInternal(next);
    onChangeRef.current?.(next);
  }, []);

  const stage = useCallback((tag: ReviewerTag) => {
    setStagedInternal((current) => {
      if (current.some((t) => t.tagId === tag.tagId)) return current;
      const next = [...current, tag];
      onChangeRef.current?.(next);
      return next;
    });
  }, []);

  const unstage = useCallback((tagId: string) => {
    setStagedInternal((current) => {
      const next = current.filter((t) => t.tagId !== tagId);
      if (next.length === current.length) return current;
      onChangeRef.current?.(next);
      return next;
    });
  }, []);

  const setStaged = useCallback((next: readonly ReviewerTag[]) => apply(next), [apply]);

  const clear = useCallback(() => {
    setStagedInternal((current) => {
      if (current.length === 0) return current;
      const next: readonly ReviewerTag[] = [];
      onChangeRef.current?.(next);
      return next;
    });
  }, []);

  const stagedSet = useMemo(() => new Set(staged.map((t) => t.tagId)), [staged]);
  const has = useCallback((tagId: string) => stagedSet.has(tagId), [stagedSet]);

  return { staged, stage, unstage, setStaged, clear, has };
}
