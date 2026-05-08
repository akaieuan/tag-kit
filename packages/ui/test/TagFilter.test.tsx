import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagFilter, type TagFilterValue } from "../src/TagFilter.js";
import type { TagCatalogEntry } from "@tag-kit/core";

const CATALOG: readonly TagCatalogEntry[] = [
  {
    tagId: "text.toxic",
    displayName: "Toxic",
    description: "x",
    applicableModalities: ["text"],
    severity: "warn",
    group: "Toxicity",
    supportsSegmentScope: false,
    supportsSpanScope: true,
  },
  {
    tagId: "image.nsfw",
    displayName: "NSFW",
    description: "x",
    applicableModalities: ["image"],
    severity: "danger",
    group: "Safety",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },
  {
    tagId: "audio.harassment",
    displayName: "Audio harassment",
    description: "x",
    applicableModalities: ["audio"],
    severity: "danger",
    group: "Audio",
    supportsSegmentScope: true,
    supportsSpanScope: false,
  },
];

describe("TagFilter", () => {
  it("renders one option per unique facet value, with counts", () => {
    const { container } = render(
      <TagFilter catalog={CATALOG} value={{}} onChange={() => undefined} />,
    );
    const options = container.querySelectorAll('[data-tag-kit="filter-option"]');
    // 3 facets: severity (warn, danger), group (Audio, Safety, Toxicity), modality (audio, image, text)
    expect(options).toHaveLength(2 + 3 + 3);
  });

  it("marks active options with data-tag-kit-active=true", () => {
    const value: TagFilterValue = { severity: ["danger"] };
    const { container } = render(
      <TagFilter catalog={CATALOG} value={value} onChange={() => undefined} />,
    );
    const dangerOption = container.querySelector('[data-facet="severity"][data-value="danger"]');
    const warnOption = container.querySelector('[data-facet="severity"][data-value="warn"]');
    expect(dangerOption?.getAttribute("data-tag-kit-active")).toBe("true");
    expect(warnOption?.getAttribute("data-tag-kit-active")).toBe("false");
  });

  it("toggle() adds the value to the corresponding facet allowlist", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<TagFilter catalog={CATALOG} value={{}} onChange={onChange} />);
    const dangerOption = container.querySelector<HTMLButtonElement>(
      '[data-facet="severity"][data-value="danger"]',
    );
    await user.click(dangerOption!);
    expect(onChange).toHaveBeenCalledWith({ severity: ["danger"] });
  });

  it("toggle() removes the value when it's already active", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <TagFilter catalog={CATALOG} value={{ severity: ["danger"] }} onChange={onChange} />,
    );
    const dangerOption = container.querySelector<HTMLButtonElement>(
      '[data-facet="severity"][data-value="danger"]',
    );
    await user.click(dangerOption!);
    expect(onChange).toHaveBeenCalledWith({ severity: [] });
  });

  it("respects the facets prop to limit which facets are shown", () => {
    const { container } = render(
      <TagFilter catalog={CATALOG} value={{}} onChange={() => undefined} facets={["severity"]} />,
    );
    const options = container.querySelectorAll('[data-tag-kit="filter-option"]');
    expect(options).toHaveLength(2); // severity has only 2 unique values
    const facetAttrs = Array.from(options).map((o) => o.getAttribute("data-facet"));
    expect(facetAttrs.every((f) => f === "severity")).toBe(true);
  });

  it("invokes the children render-prop with TagFilterRenderInfo", () => {
    render(
      <TagFilter catalog={CATALOG} value={{ severity: ["danger"] }} onChange={() => undefined}>
        {(info) => (
          <div data-testid="custom">
            options: {info.options.length}, danger active:{" "}
            {String(info.options.find((o) => o.value === "danger")?.active)}
          </div>
        )}
      </TagFilter>,
    );
    expect(screen.getByTestId("custom")).toHaveTextContent("danger active: true");
  });

  it("clear() in render-info empties the value", () => {
    const onChange = vi.fn();
    let capturedClear: (() => void) | null = null;
    render(
      <TagFilter
        catalog={CATALOG}
        value={{ severity: ["danger"], group: ["Audio"] }}
        onChange={onChange}
      >
        {(info) => {
          capturedClear = info.clear;
          return null;
        }}
      </TagFilter>,
    );
    capturedClear!();
    expect(onChange).toHaveBeenCalledWith({});
  });
});
