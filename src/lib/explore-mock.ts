export interface ExploreTheme {
  id: string;
  emoji: string;
  name: string;
  subtitle: string;
  priceLabel: string;
  imageUrl: string;
  imageAlt: string;
}

export const EXPLORE_THEMES: ExploreTheme[] = [
  {
    id: "under-1000",
    emoji: "🔥",
    name: "Under ¥1,000",
    subtitle: "Cheap & Happy",
    priceLabel: "~¥1,000",
    imageUrl: "/ramens/ramen1.jpg",
    imageAlt: "Affordable ramen bowl",
  },
  {
    id: "date-night",
    emoji: "🤍",
    name: "Date Night",
    subtitle: "Romantic Vibes",
    priceLabel: "¥1,000~2,000",
    imageUrl: "/ramens/ramen2.jpg",
    imageAlt: "Romantic dining atmosphere",
  },
  {
    id: "treat-yourself",
    emoji: "👑",
    name: "Treat Yourself",
    subtitle: "A Little Luxury",
    priceLabel: "¥2,000~3,000",
    imageUrl: "/ramens/ramen3.jpg",
    imageAlt: "Luxurious ramen course",
  },
  {
    id: "need-energy",
    emoji: "⚡",
    name: "Need Energy",
    subtitle: "Power Food",
    priceLabel: "~¥2,000",
    imageUrl: "/ramens/ramne4.jpg",
    imageAlt: "Hearty power-food ramen",
  },
  {
    id: "with-friends",
    emoji: "🐾",
    name: "With Friends",
    subtitle: "Share & Enjoy",
    priceLabel: "~¥1,500",
    imageUrl: "/ramens/ramen5.jpg",
    imageAlt: "Shareable ramen with friends",
  },
  {
    id: "healthy",
    emoji: "🍃",
    name: "Healthy Choice",
    subtitle: "Clean & Green",
    priceLabel: "~¥1,000",
    imageUrl: "/ramens/ramen6.jpg",
    imageAlt: "ヘルシーな料理",
  },
  {
    id: "late-night",
    emoji: "🌙",
    name: "Late Night Bites",
    subtitle: "Open Late",
    priceLabel: "~¥1,000",
    imageUrl: "/ramens/ramen7.jpg",
    imageAlt: "深夜営業の料理",
  },
  {
    id: "local-gems",
    emoji: "📍",
    name: "Local Gems",
    subtitle: "Off the Beaten Path",
    priceLabel: "~¥1,500",
    imageUrl: "/ramens/ramen8.jpg",
    imageAlt: "隠れた名店",
  },
  {
    id: "instagrammable",
    emoji: "📷",
    name: "Instagrammable",
    subtitle: "Picture Perfect",
    priceLabel: "~¥2,000",
    imageUrl: "/ramens/ramen1.jpg",
    imageAlt: "映える料理",
  },
  {
    id: "surprise",
    emoji: "🔀",
    name: "Surprise Me",
    subtitle: "Random Picks",
    priceLabel: "All",
    imageUrl: "/ramens/ramen3.jpg",
    imageAlt: "サプライズ",
  },
];
