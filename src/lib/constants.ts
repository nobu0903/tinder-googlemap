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
  images: [
    { src: "/ramens/ramen1.jpg", alt: "濃厚味噌ラーメン" },
    { src: "/ramens/ramen2.jpg", alt: "豚骨ラーメン" },
    { src: "/ramens/ramen3.jpg", alt: "塩ラーメン" },
    { src: "/ramens/ramne4.jpg", alt: "醤油ラーメン" },
    { src: "/ramens/ramen5.jpg", alt: "担々麺" },
    { src: "/ramens/ramen6.jpg", alt: "煮干しラーメン" },
    { src: "/ramens/ramen7.jpg", alt: "つけ麺" },
    { src: "/ramens/ramen8.jpg", alt: "ダブルスープラーメン" },
  ],
} as const;
