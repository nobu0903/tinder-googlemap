import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  SettingsRowButton,
  SettingsRowExternalLink,
  SettingsRowInfo,
  SettingsRowLink,
  SettingsSection,
} from "@/components/settings/settings-rows";

describe("SettingsSection", () => {
  it("renders the section label and children", () => {
    render(
      <SettingsSection label="Account">
        <p>child content</p>
      </SettingsSection>,
    );

    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});

describe("SettingsRowInfo", () => {
  it("shows the label and value", () => {
    render(<SettingsRowInfo label="Signed in as" value="a@b.com" />);

    expect(screen.getByText("Signed in as")).toBeInTheDocument();
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
  });
});

describe("SettingsRowButton", () => {
  it("invokes onClick when pressed", () => {
    const onClick = vi.fn();
    render(<SettingsRowButton label="Sign out" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsRowLink", () => {
  it("links to the provided href", () => {
    render(<SettingsRowLink label="Upgrade to Pro" href="/pro" />);

    expect(screen.getByRole("link", { name: /Upgrade to Pro/i })).toHaveAttribute(
      "href",
      "/pro",
    );
  });
});

describe("SettingsRowExternalLink", () => {
  it("opens externally with safe rel attributes", () => {
    render(
      <SettingsRowExternalLink
        label="Send feedback"
        href="https://example.com/form"
      />,
    );

    const link = screen.getByRole("link", { name: /Send feedback/i });
    expect(link).toHaveAttribute("href", "https://example.com/form");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
