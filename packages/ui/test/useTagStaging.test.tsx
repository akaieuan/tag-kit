import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTagStaging } from "../src/useTagStaging.js";

describe("useTagStaging", () => {
  it("starts empty by default", () => {
    const { result } = renderHook(() => useTagStaging());
    expect(result.current.staged).toEqual([]);
    expect(result.current.has("anything")).toBe(false);
  });

  it("seeds initial state", () => {
    const { result } = renderHook(() =>
      useTagStaging({ initial: [{ tagId: "audio.harassment" }] }),
    );
    expect(result.current.staged).toEqual([{ tagId: "audio.harassment" }]);
    expect(result.current.has("audio.harassment")).toBe(true);
  });

  it("stage appends a new tag", () => {
    const { result } = renderHook(() => useTagStaging());
    act(() => result.current.stage({ tagId: "audio.harassment" }));
    expect(result.current.staged).toEqual([{ tagId: "audio.harassment" }]);
    expect(result.current.has("audio.harassment")).toBe(true);
  });

  it("stage is a no-op for an already-staged tagId", () => {
    const { result } = renderHook(() =>
      useTagStaging({ initial: [{ tagId: "audio.harassment" }] }),
    );
    act(() => result.current.stage({ tagId: "audio.harassment", note: "different note" }));
    expect(result.current.staged).toHaveLength(1);
    expect(result.current.staged[0]?.note).toBeUndefined();
  });

  it("unstage removes the matching tag", () => {
    const { result } = renderHook(() =>
      useTagStaging({
        initial: [{ tagId: "audio.harassment" }, { tagId: "video.violence" }],
      }),
    );
    act(() => result.current.unstage("audio.harassment"));
    expect(result.current.staged).toEqual([{ tagId: "video.violence" }]);
    expect(result.current.has("audio.harassment")).toBe(false);
  });

  it("unstage is a no-op for unknown tagIds", () => {
    const { result } = renderHook(() =>
      useTagStaging({ initial: [{ tagId: "audio.harassment" }] }),
    );
    const before = result.current.staged;
    act(() => result.current.unstage("nope"));
    expect(result.current.staged).toBe(before); // referentially equal
  });

  it("setStaged replaces wholesale", () => {
    const { result } = renderHook(() => useTagStaging());
    act(() =>
      result.current.setStaged([{ tagId: "audio.harassment" }, { tagId: "video.violence" }]),
    );
    expect(result.current.staged).toHaveLength(2);
  });

  it("clear empties the staged set", () => {
    const { result } = renderHook(() =>
      useTagStaging({ initial: [{ tagId: "audio.harassment" }] }),
    );
    act(() => result.current.clear());
    expect(result.current.staged).toEqual([]);
  });

  it("onChange fires on every meaningful change", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useTagStaging({ onChange }));

    act(() => result.current.stage({ tagId: "audio.harassment" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith([{ tagId: "audio.harassment" }]);

    act(() => result.current.unstage("audio.harassment"));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith([]);

    // No-op stage doesn't fire onChange.
    onChange.mockClear();
    act(() => result.current.unstage("ghost"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
