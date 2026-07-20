export const NAV_TABS = [
  { id: "swipe", label: "SWIPE", emoji: "🔥", href: "/" },
  { id: "explore", label: "EXPLORE", emoji: "🔍", href: "/explore" },
  { id: "collection", label: "COLLECTION", emoji: "📁", href: "/collection" },
  { id: "settings", label: "SETTINGS", emoji: "👤", href: "/settings" },
] as const;

export type NavTabId = (typeof NAV_TABS)[number]["id"];

export const MOCK_SPOT = {
  name: "Menya Soul Heaven",
  rating: 4.8,
  reviewCount: 328,
  distanceKm: 0.5,
  category: "Ramen · Tsukemen",
  priceRange: "1000-2000",
  isOpen: true,
  todayClose: "22:00",
  address: "1-11 Udagawacho, Shibuya-ku, Tokyo, Yanagi Bldg. 1F",
  images: [
    { src: "/ramens/ramen1.jpg", alt: "Rich Miso Ramen" },
    { src: "/ramens/ramen2.jpg", alt: "Tonkotsu Ramen" },
    { src: "/ramens/ramen3.jpg", alt: "Shio Ramen" },
    { src: "/ramens/ramne4.jpg", alt: "Shoyu Ramen" },
    { src: "/ramens/ramen5.jpg", alt: "Tantanmen" },
    { src: "/ramens/ramen6.jpg", alt: "Niboshi Ramen" },
    { src: "/ramens/ramen7.jpg", alt: "Tsukemen" },
    { src: "/ramens/ramen8.jpg", alt: "Double Soup Ramen" },
  ],
  reviews: [
    {
      id: "r1",
      username: "ramen_love",
      avatarSrc: "/ramens/ramen1.jpg",
      rating: 5.0,
      daysAgo: 2,
      text: "The miso richness is unreal. Soup so thick I drank every last drop. Chashu is melt-in-your-mouth tender!",
    },
    {
      id: "r2",
      username: "tokyo_foodie",
      avatarSrc: "/ramens/ramen2.jpg",
      rating: 4.5,
      daysAgo: 5,
      text: "Great ambiance, consistent quality. The kind of place you keep coming back to.",
    },
    {
      id: "r3",
      username: "noodle_master",
      avatarSrc: "/ramens/ramen3.jpg",
      rating: 4.0,
      daysAgo: 7,
      text: "Noodles have great bite and pair perfectly with the broth. Spicy miso is also highly recommended!",
    },
  ],
  weeklyHours: [
    { day: "Monday",    lunch: "11:00 - 15:00", dinner: "17:00 - 22:00" },
    { day: "Tuesday",   lunch: "11:00 - 15:00", dinner: "17:00 - 22:00" },
    { day: "Wednesday", lunch: "11:00 - 15:00", dinner: "17:00 - 22:00" },
    { day: "Thursday",  lunch: "11:00 - 15:00", dinner: "17:00 - 22:00" },
    { day: "Friday",    lunch: "11:00 - 15:00", dinner: "17:00 - 23:00" },
    { day: "Saturday",  lunch: "11:00 - 15:00", dinner: "11:00 - 23:00" },
    { day: "Sunday",    lunch: "11:00 - 15:00", dinner: "11:00 - 22:00" },
  ],
} as const;
