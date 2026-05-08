import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagSummary } from "../src/TagSummary.js";
import type { ReviewerTag, TagCatalogEntry } from "@tag-kit/core";

const CATALOG: readonly TagCatalogEntry[] = [
  {
    tagId: "text.toxic",
    displayName: "Toxic text",
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
];

const TAGS: readonly ReviewerTag[] = [
  { tagId: "text.toxic" },
  { tagId: "text.toxic" },
  { tagId: "image.nsfw" },
];

describe("TagSummary", () => {
  it("buckets by tagId by default", () => {
    const { container } = render(<TagSummary tags={TAGS} />);
    const buckets = container.querySelectorAll('[data-tag-kit="summary-bucket"]');
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.getAttribute("data-key")).toBe("image.nsfw");
    expect(buckets[1]?.getAttribute("data-key")).toBe("text.toxic");
  });

  it("buckets by severity when catalog is supplied", () => {
    const { container } = render(<TagSummary tags={TAGS} catalog={CATALOG} groupBy="severity" />);
    const buckets = container.querySelectorAll('[data-tag-kit="summary-bucket"]');
    const keys = Array.from(buckets).map((b) => b.getAttribute("data-key"));
    expect(keys).toEqual(["danger", "warn"]); // alphabetical
  });

  it("buckets by group when catalog is supplied", () => {
    const { container } = render(<TagSummary tags={TAGS} catalog={CATALOG} groupBy="group" />);
    const buckets = container.querySelectorAll('[data-tag-kit="summary-bucket"]');
    const keys = Array.from(buckets).map((b) => b.getAttribute("data-key"));
    expect(keys).toEqual(["Safety", "Toxicity"]);
  });

  it("buckets by modality, preferring tag.scope.modality over catalog inference", () => {
    const tags: readonly ReviewerTag[] = [
      { tagId: "text.toxic", scope: { modality: "text" } },
      { tagId: "image.nsfw" }, // catalog says image
    ];
    const { container } = render(<TagSummary tags={tags} catalog={CATALOG} groupBy="modality" />);
    const buckets = container.querySelectorAll('[data-tag-kit="summary-bucket"]');
    const keys = Array.from(buckets).map((b) => b.getAttribute("data-key"));
    expect(keys).toEqual(["image", "text"]);
  });

  it("falls back to 'unknown' when severity/group/modality cannot be resolved", () => {
    const tags: readonly ReviewerTag[] = [{ tagId: "ghost.tag" }];
    const { container } = render(<TagSummary tags={tags} groupBy="severity" />);
    expect(container.querySelector('[data-key="unknown"]')).toBeInTheDocument();
  });

  it("renders count and key children for the default markup", () => {
    render(<TagSummary tags={TAGS} />);
    // text.toxic appears twice
    const counts = screen.getAllByText("2");
    expect(counts.length).toBeGreaterThan(0);
  });

  it("invokes the children render-prop with TagSummaryRenderInfo", () => {
    render(
      <TagSummary tags={TAGS} groupBy="tagId">
        {(info) => (
          <div data-testid="custom">
            total: {info.total}, buckets: {info.buckets.length}
          </div>
        )}
      </TagSummary>,
    );
    expect(screen.getByTestId("custom")).toHaveTextContent("total: 3, buckets: 2");
  });
});
