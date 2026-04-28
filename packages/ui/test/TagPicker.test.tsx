import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagPicker } from "../src/TagPicker.js";
import type { TagCatalogEntry } from "@tag-kit/core";

const CATALOG: readonly TagCatalogEntry[] = [
  {
    tagId: "text.toxic",
    displayName: "Toxic text",
    description: "Hostile or demeaning text content.",
    applicableModalities: ["text"],
    severity: "warn",
    group: "Toxicity",
    supportsSegmentScope: false,
    supportsSpanScope: true,
  },
  {
    tagId: "image.nsfw",
    displayName: "NSFW image",
    description: "Adult or graphic image content.",
    applicableModalities: ["image"],
    severity: "danger",
    group: "Safety",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },
  {
    tagId: "context.satire-flag",
    displayName: "Satire",
    description: "Whole-event satire indicator.",
    applicableModalities: [],
    severity: "info",
    group: "Context",
    supportsSegmentScope: false,
    supportsSpanScope: false,
  },
];

function renderPicker(overrides: Partial<React.ComponentProps<typeof TagPicker>> = {}) {
  const onPick = overrides.onPick ?? vi.fn();
  return {
    onPick,
    ...render(
      <TagPicker catalog={CATALOG} staged={[]} modality={null} onPick={onPick} {...overrides} />,
    ),
  };
}

describe("TagPicker — modality filter", () => {
  it("hides entries whose applicableModalities does not include the modality", () => {
    renderPicker({ modality: "text" });
    expect(screen.getByText("Toxic text")).toBeInTheDocument();
    expect(screen.queryByText("NSFW image")).not.toBeInTheDocument();
  });

  it("shows entries with empty applicableModalities (universal) for any modality", () => {
    renderPicker({ modality: "text" });
    expect(screen.getByText("Satire")).toBeInTheDocument();
  });

  it("shows every entry when modality is null", () => {
    renderPicker({ modality: null });
    expect(screen.getByText("Toxic text")).toBeInTheDocument();
    expect(screen.getByText("NSFW image")).toBeInTheDocument();
    expect(screen.getByText("Satire")).toBeInTheDocument();
  });
});

describe("TagPicker — search filter", () => {
  it("matches against tagId substrings", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.type(screen.getByLabelText("Search tags"), "image.nsfw");
    expect(screen.getByText("NSFW image")).toBeInTheDocument();
    expect(screen.queryByText("Toxic text")).not.toBeInTheDocument();
  });

  it("matches against displayName substrings", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.type(screen.getByLabelText("Search tags"), "Toxic");
    expect(screen.getByText("Toxic text")).toBeInTheDocument();
    expect(screen.queryByText("NSFW image")).not.toBeInTheDocument();
  });

  it("matches against description substrings", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.type(screen.getByLabelText("Search tags"), "Adult or graphic");
    expect(screen.getByText("NSFW image")).toBeInTheDocument();
    expect(screen.queryByText("Toxic text")).not.toBeInTheDocument();
  });

  it("renders the empty-state marker when nothing matches", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.type(screen.getByLabelText("Search tags"), "zzz-no-match");
    expect(screen.getByText("no matching tags")).toBeInTheDocument();
  });

  it("seeds initialQuery into the search field", () => {
    renderPicker({ initialQuery: "Toxic" });
    expect(screen.getByLabelText("Search tags")).toHaveValue("Toxic");
    expect(screen.queryByText("NSFW image")).not.toBeInTheDocument();
  });
});

describe("TagPicker — grouping", () => {
  it("renders group labels in alphabetical order", () => {
    renderPicker();
    const labels = screen.getAllByText(/Context|Safety|Toxicity/);
    const groupLabels = labels
      .filter((el) => el.getAttribute("data-tag-kit") === "picker-group-label")
      .map((el) => el.textContent);
    expect(groupLabels).toEqual(["Context", "Safety", "Toxicity"]);
  });
});

describe("TagPicker — staged entries are disabled", () => {
  it("disables a tag's button when its tagId is in `staged`", () => {
    renderPicker({ staged: [{ tagId: "text.toxic" }] });
    const button = screen.getByRole("button", { name: /Toxic text/ });
    expect(button).toBeDisabled();
  });

  it("does not fire onPick when a staged entry is clicked", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker({ staged: [{ tagId: "text.toxic" }] });
    const button = screen.getByRole("button", { name: /Toxic text/ });
    await user.click(button).catch(() => undefined);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("TagPicker — onPick", () => {
  it("fires with a ReviewerTag-shaped object containing tagId on click", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await user.click(screen.getByRole("button", { name: /NSFW image/ }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith({ tagId: "image.nsfw" });
  });
});

describe("TagPicker — severity attribute", () => {
  it("propagates severity onto the per-entry button", () => {
    renderPicker();
    const dangerButton = screen.getByRole("button", { name: /NSFW image/ });
    expect(dangerButton).toHaveAttribute("data-tag-kit-severity", "danger");
    const warnButton = screen.getByRole("button", { name: /Toxic text/ });
    expect(warnButton).toHaveAttribute("data-tag-kit-severity", "warn");
  });
});

describe("TagPicker — children render-prop", () => {
  it("wraps the picker content with the supplied function when provided", () => {
    render(
      <TagPicker catalog={CATALOG} staged={[]} modality={null} onPick={() => undefined}>
        {(content) => <section data-testid="wrapper">{content}</section>}
      </TagPicker>,
    );
    const wrapper = screen.getByTestId("wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(within(wrapper).getByText("Toxic text")).toBeInTheDocument();
  });
});
