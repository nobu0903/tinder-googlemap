export const NAV_TABS = [
  { id: "swipe", label: "SWIPE", emoji: "🔥", href: "/" },
  { id: "explore", label: "EXPLORE", emoji: "🔍", href: "/explore" },
  { id: "collection", label: "COLLECTION", emoji: "📁", href: "/collection" },
] as const;

export type NavTabId = (typeof NAV_TABS)[number]["id"];

export const MOCK_SPOT = {
  name: "Menya Soul Heaven",
  rating: 4.8,
  reviewCount: 328,
  distanceKm: 0.5,
  // category: "Rich Miso Ramen",
  priceRange: "1000-2000",
  isOpen: true,
  imageUrl:
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=80",
  imageAlt: "Rich miso ramen bowl with chashu and soft-boiled egg",
} as const;
