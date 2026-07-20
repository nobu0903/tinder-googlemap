import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CollectionSummary } from "@/components/collection/collection-summary";
import type { LikedSpot } from "@/types/backend";

function makeSpot(overrides: Partial<LikedSpot> = {}): LikedSpot {
  return {
    spotId: "spot-1",
    name: "Test Ramen",
    rating: 4.5,
    priceLevel: 2,
    primaryType: "ramen_restaurant",
    address: "Sapporo",
    lat: 43.06,
    lng: 141.35,
    photos: [{ url: "https://example.com/a.jpg", width: 100, height: 100 }],
    bookingUrl: null,
    likedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CollectionSummary", () => {
  it("renders the total count and plural label", () => {
    render(
      <CollectionSummary
        totalCount={3}
        previewSpots={[makeSpot(), makeSpot({ spotId: "spot-2" })]}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("amazing places saved")).toBeInTheDocument();
  });

  it("uses singular label for one spot", () => {
    render(
      <CollectionSummary totalCount={1} previewSpots={[makeSpot()]} />,
    );

    expect(screen.getByText("amazing place saved")).toBeInTheDocument();
  });

  it("shows an ellipsis while loading", () => {
    render(
      <CollectionSummary totalCount={0} isLoading previewSpots={[]} />,
    );

    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("renders preview photo alt text", () => {
    render(
      <CollectionSummary
        totalCount={1}
        previewSpots={[makeSpot({ name: "Soul Noodles" })]}
      />,
    );

    expect(screen.getByAltText("Soul Noodles")).toBeInTheDocument();
  });

  it("hides preview stack when there are no spots", () => {
    const { container } = render(
      <CollectionSummary totalCount={0} previewSpots={[]} />,
    );

    expect(container.querySelector("img")).toBeNull();
  });
});
