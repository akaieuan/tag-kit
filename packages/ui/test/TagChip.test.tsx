import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagChip } from "../src/TagChip.js";
import type { ReviewerTag, TagCatalogEntry } from "@tag-kit/core";

const ENTRY: TagCatalogEntry = {
  tagId: "audio.harassment",
  displayName: "Audio harassment",
  description: "Spoken harassment, slurs, or threats.",
  applicableModalities: ["audio", "video"],
  severity: "danger",
  group: "Audio",
  supportsSegmentScope: true,
  supportsSpanScope: false,
};

const TAG: ReviewerTag = {
  tagId: "audio.harassment",
  scope: { modality: "audio", segment: { start: 12, end: 24 } },
};

describe("TagChip — default render with entry", () => {
  it("renders the entry displayName as the label", () => {
    render(<TagChip tag={TAG} entry={ENTRY} />);
    expect(screen.getByText("Audio harassment")).toBeInTheDocument();
  });

  it("emits data-tag-kit-severity reflecting the entry's severity", () => {
    const { container } = render(<TagChip tag={TAG} entry={ENTRY} />);
    const chip = container.querySelector('[data-tag-kit="chip"]');
    expect(chip).toHaveAttribute("data-tag-kit-severity", "danger");
  });

  it("does not render a remove button when onRemove is not provided", () => {
    render(<TagChip tag={TAG} entry={ENTRY} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("TagChip — fallback when entry is undefined", () => {
  it("falls back to rendering the raw tagId as the label", () => {
    render(<TagChip tag={TAG} />);
    expect(screen.getByText("audio.harassment")).toBeInTheDocument();
  });

  it("severity defaults to neutral when entry is undefined", () => {
    const { container } = render(<TagChip tag={TAG} />);
    const chip = container.querySelector('[data-tag-kit="chip"]');
    expect(chip).toHaveAttribute("data-tag-kit-severity", "neutral");
  });
});

describe("TagChip — onRemove", () => {
  it("renders a remove button with the correct aria-label", () => {
    const onRemove = vi.fn();
    render(<TagChip tag={TAG} entry={ENTRY} onRemove={onRemove} />);
    expect(screen.getByRole("button", { name: "Remove tag Audio harassment" })).toBeInTheDocument();
  });

  it("falls back to the raw tagId in the aria-label when entry is undefined", () => {
    const onRemove = vi.fn();
    render(<TagChip tag={TAG} onRemove={onRemove} />);
    expect(screen.getByRole("button", { name: "Remove tag audio.harassment" })).toBeInTheDocument();
  });

  it("fires the callback on click", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<TagChip tag={TAG} entry={ENTRY} onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: /Remove tag/ }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("TagChip — state attribute", () => {
  it("renders data-tag-kit-state when state is provided", () => {
    const { container } = render(<TagChip tag={TAG} entry={ENTRY} state="staged" />);
    const chip = container.querySelector('[data-tag-kit="chip"]');
    expect(chip).toHaveAttribute("data-tag-kit-state", "staged");
  });

  it("omits data-tag-kit-state when state is undefined", () => {
    const { container } = render(<TagChip tag={TAG} entry={ENTRY} />);
    const chip = container.querySelector('[data-tag-kit="chip"]');
    expect(chip).not.toHaveAttribute("data-tag-kit-state");
  });
});

describe("TagChip — title composition", () => {
  it("composes title as `<tagId> — <note>` when note is present", () => {
    const tagWithNote: ReviewerTag = { ...TAG, note: "context: harasser names target" };
    const { container } = render(<TagChip tag={tagWithNote} entry={ENTRY} />);
    const chip = container.querySelector('[data-tag-kit="chip"]');
    expect(chip).toHaveAttribute("title", "audio.harassment — context: harasser names target");
  });

  it("uses just the tagId as title when no note is present", () => {
    const { container } = render(<TagChip tag={TAG} entry={ENTRY} />);
    const chip = container.querySelector('[data-tag-kit="chip"]');
    expect(chip).toHaveAttribute("title", "audio.harassment");
  });
});

describe("TagChip — children render-prop", () => {
  it("invokes the function with TagChipRenderInfo and replaces default markup", () => {
    const renderProp = vi.fn((info) => (
      <div data-testid="custom" data-severity={info.severity}>
        custom: {info.label}
      </div>
    ));
    render(
      <TagChip tag={TAG} entry={ENTRY} state="staged" onRemove={() => undefined}>
        {renderProp}
      </TagChip>,
    );
    expect(renderProp).toHaveBeenCalledTimes(1);
    const passedInfo = renderProp.mock.calls[0]![0];
    expect(passedInfo.label).toBe("Audio harassment");
    expect(passedInfo.severity).toBe("danger");
    expect(passedInfo.state).toBe("staged");
    expect(passedInfo.title).toBe("audio.harassment");
    expect(typeof passedInfo.onRemove).toBe("function");

    const custom = screen.getByTestId("custom");
    expect(custom).toHaveTextContent("custom: Audio harassment");
    expect(custom).toHaveAttribute("data-severity", "danger");
    expect(document.querySelector('[data-tag-kit="chip"]')).not.toBeInTheDocument();
  });
});
