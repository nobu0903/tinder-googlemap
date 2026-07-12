// Chain restaurant filter — exclude nationwide franchises from feed/ingest.

/** Normalise for loose matching (full-width, case) */
function normaliseName(name: string): string {
  return name.normalize("NFKC").toLowerCase();
}

/**
 * Known chain brand substrings (JP + EN).
 * Matched anywhere in the place display name.
 */
const CHAIN_BRAND_MARKERS: string[] = [
  // Fast food / burger
  "マクドナルド",
  "mcdonald",
  "マック",
  "mos burger",
  "モスバーガー",
  "バーガーキング",
  "burger king",
  "ロッテリア",
  "lotteria",
  "フレッシュネス",
  "freshness burger",
  // Chicken
  "ケンタッキー",
  "kfc",
  "からあげ専門",
  // Beef bowl / fast Japanese
  "すき家",
  "吉野家",
  "松屋",
  "なか卯",
  "はなまるうどん",
  "丸亀製麺",
  // Coffee / cafe chains
  "スターバックス",
  "starbucks",
  "コメダ珈琲",
  "コメダコーヒー",
  "ドトール",
  "doutor",
  "タリーズ",
  "tully's",
  "タリーズコーヒー",
  "エクセルシオール",
  "excelsior",
  "プロント",
  "pronto",
  "ベローチェ",
  "veloce",
  // Family restaurant
  "ガスト",
  "gusto",
  "サイゼリヤ",
  "saizeriya",
  "デニーズ",
  "denny's",
  "ジョナサン",
  "jonathan",
  "ココス",
  "cocos",
  "びっくりドンキー",
  "big boy",
  "ロイヤルホスト",
  "royal host",
  "夢庵",
  "むげん",
  // Sushi / conveyor belt
  "スシロー",
  "sushiro",
  "はま寿司",
  "hamazushi",
  "くら寿司",
  "kura sushi",
  "かっぱ寿司",
  "kappa sushi",
  // Ramen / noodle chains
  "一蘭",
  "ichiran",
  "一風堂",
  "ippudo",
  "天下一品",
  // Other major chains
  "牛角",
  "gyukaku",
  "しゃぶ葉",
  "syabuyo",
  "焼肉きんぐ",
  "yakiniku king",
  "串カツ田中",
  "魚べい",
  "uobei",
  "無添くら寿司",
  "ミスタードーナツ",
  "mister donut",
  "ドミノ",
  "domino's pizza",
  "ピザハット",
  "pizza hut",
  "サブウェイ",
  "subway",
  "サーティワン",
  "baskin-robbins",
  "餃子の王将",
  "王将",
  "日高屋",
  "hidakaya",
  "coco壱番屋",
  "coco ichibanya",
  "松のや",
  "かつや",
  "てんや",
  "ゆず庵",
];

/** Primary types dominated by chain franchises */
export const CHAIN_PRIMARY_TYPES = new Set([
  "fast_food_restaurant",
  "sandwich_shop",
  "hamburger_restaurant",
  "meal_takeaway",
]);

export function isChainName(name: string): boolean {
  const n = normaliseName(name);
  return CHAIN_BRAND_MARKERS.some((marker) => n.includes(normaliseName(marker)));
}

export function isChainPlace(place: {
  displayName?: { text: string };
  primaryType?: string;
  types?: string[];
}): boolean {
  const name = place.displayName?.text ?? "";
  if (isChainName(name)) return true;

  const primary = place.primaryType ?? "";
  if (primary && CHAIN_PRIMARY_TYPES.has(primary)) return true;

  const types = place.types ?? [];
  if (types.some((t) => CHAIN_PRIMARY_TYPES.has(t))) return true;

  return false;
}

export function isChainSpotRow(row: {
  name: string;
  primary_type?: string | null;
}): boolean {
  if (isChainName(row.name)) return true;
  if (row.primary_type && CHAIN_PRIMARY_TYPES.has(row.primary_type)) return true;
  return false;
}

export function filterChainSpotRows<T extends { name: string; primary_type?: string | null }>(
  rows: T[],
): T[] {
  return rows.filter((row) => !isChainSpotRow(row));
}
