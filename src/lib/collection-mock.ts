export type CollectionTabId = "all" | "favorites" | "visited";

export interface SpotImage {
  src: string;
  alt: string;
}

export interface CollectionSpot {
  id: string;
  name: string;
  category: string;
  distanceKm: number;
  rating: number;
  priceLevel: string;
  images: SpotImage[];
  isFavorite: boolean;
  isVisited: boolean;
}

export const COLLECTION_TABS = [
  { id: "all" as const, label: "All", count: 42 },
  { id: "favorites" as const, label: "Favorites", count: 18 },
  { id: "visited" as const, label: "Visited", count: 7 },
];

const ALL_RAMEN_IMAGES = [
  { src: "/ramens/ramen1.jpg", alt: "濃厚味噌ラーメン" },
  { src: "/ramens/ramen2.jpg", alt: "豚骨ラーメン" },
  { src: "/ramens/ramen3.jpg", alt: "塩ラーメン" },
  { src: "/ramens/ramne4.jpg", alt: "醤油ラーメン" },
  { src: "/ramens/ramen5.jpg", alt: "担々麺" },
  { src: "/ramens/ramen6.jpg", alt: "煮干しラーメン" },
  { src: "/ramens/ramen7.jpg", alt: "つけ麺" },
  { src: "/ramens/ramen8.jpg", alt: "ダブルスープラーメン" },
];

export const COLLECTION_SPOTS: CollectionSpot[] = [
  {
    id: "1",
    name: "Menya Soul Heaven",
    category: "Rich Miso Ramen",
    distanceKm: 0.5,
    rating: 4.7,
    priceLevel: "¥¥",
    images: [ALL_RAMEN_IMAGES[0], ALL_RAMEN_IMAGES[1], ALL_RAMEN_IMAGES[2]],
    isFavorite: true,
    isVisited: false,
  },
  {
    id: "2",
    name: "Fuunji Tonkotsu",
    category: "Tonkotsu Ramen",
    distanceKm: 1.2,
    rating: 4.8,
    priceLevel: "¥¥",
    images: [ALL_RAMEN_IMAGES[1], ALL_RAMEN_IMAGES[3], ALL_RAMEN_IMAGES[5]],
    isFavorite: true,
    isVisited: true,
  },
  {
    id: "3",
    name: "Kuro Shio",
    category: "Shio Ramen",
    distanceKm: 0.8,
    rating: 4.6,
    priceLevel: "¥¥",
    images: [ALL_RAMEN_IMAGES[2], ALL_RAMEN_IMAGES[4]],
    isFavorite: false,
    isVisited: false,
  },
  {
    id: "4",
    name: "Ore no Shoyu",
    category: "Shoyu Ramen",
    distanceKm: 1.5,
    rating: 4.9,
    priceLevel: "¥",
    images: [ALL_RAMEN_IMAGES[3], ALL_RAMEN_IMAGES[6], ALL_RAMEN_IMAGES[7]],
    isFavorite: true,
    isVisited: true,
  },
  {
    id: "5",
    name: "Spicy Tantanmen Lab",
    category: "Tantanmen",
    distanceKm: 0.6,
    rating: 4.5,
    priceLevel: "¥¥",
    images: [ALL_RAMEN_IMAGES[4], ALL_RAMEN_IMAGES[0]],
    isFavorite: false,
    isVisited: true,
  },
  {
    id: "6",
    name: "Niboshi Ichiro",
    category: "Niboshi Ramen",
    distanceKm: 2.1,
    rating: 4.7,
    priceLevel: "¥¥",
    images: [ALL_RAMEN_IMAGES[5], ALL_RAMEN_IMAGES[2], ALL_RAMEN_IMAGES[4]],
    isFavorite: true,
    isVisited: false,
  },
  {
    id: "7",
    name: "Tare no Kokoro",
    category: "Tsukemen",
    distanceKm: 0.9,
    rating: 4.8,
    priceLevel: "¥¥",
    images: [ALL_RAMEN_IMAGES[6], ALL_RAMEN_IMAGES[1]],
    isFavorite: false,
    isVisited: false,
  },
  {
    id: "8",
    name: "Umami Dojo",
    category: "Double Soup Ramen",
    distanceKm: 1.8,
    rating: 4.9,
    priceLevel: "¥¥¥",
    images: [ALL_RAMEN_IMAGES[7], ALL_RAMEN_IMAGES[3], ALL_RAMEN_IMAGES[5]],
    isFavorite: true,
    isVisited: true,
  },
];

export function filterCollectionSpots(
  tab: CollectionTabId,
  spots: CollectionSpot[],
): CollectionSpot[] {
  switch (tab) {
    case "favorites":
      return spots.filter((spot) => spot.isFavorite);
    case "visited":
      return spots.filter((spot) => spot.isVisited);
    default:
      return spots;
  }
}
