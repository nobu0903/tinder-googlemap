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
    // === 1. 既存チェーンの英語・表記揺れの徹底補強 ===
    "マクドナルド", "mcdonald", "マック", "macdonald",
    "mos burger", "モスバーガー", "mos",
    "バーガーキング", "burger king", "burgerking",
    "ロッテリア", "lotteria",
    "フレッシュネス", "freshness burger", "freshness",
    "ケンタッキー", "kfc", "kentucky", "からあげ専門",
    
    // 丼・うどん（英語・ローマ字追加）
    "すき家", "sukiya",
    "吉野家", "yoshinoya",
    "松屋", "matsuya",
    "なか卯", "nakau",
    "はなまるうどん", "hanamaru", "hanamaru udon",
    "丸亀製麺", "marugame", "marugame udon", "marugame seimen",
    
    // カフェ（英語・ローマ字追加）
    "スターバックス", "starbucks", "スタバ",
    "コメダ珈琲", "コメダコーヒー", "komeda", "komeda's coffee",
    "ドトール", "doutor", "doutor coffee",
    "タリーズ", "tully's", "タリーズコーヒー", "tullys",
    "エクセルシオール", "excelsior", "excelsior caffe",
    "プロント", "pronto",
    "ベローチェ", "veloce", "caffe veloce",
  
    // ファミレス（英語・ローマ字追加）
    "ガスト", "gusto",
    "サイゼリヤ", "saizeriya", "サイゼ", "saizeriya",
    "デニーズ", "denny's", "dennys",
    "ジョナサン", "jonathan", "jonathan's",
    "ココス", "cocos", "coco's",
    "びっくりドンキー", "bikkuri donkey", "bikkuri-donkey",
    "big boy", "ビッグボーイ",
    "ロイヤルホスト", "royal host", "ロイホ",
    "夢庵", "yumean",
    "むげん",
  
    // 寿司（英語・ローマ字・表記揺れ追加）
    "スシロー", "sushiro",
    "はま寿司", "hamazushi", "hama sushi", "hama-zushi",
    "くら寿司", "kura sushi", "kura", "無添くら寿司",
    "かっぱ寿司", "kappa sushi", "kappa",
    "魚べい", "uobei", "uobei sushi",
  
    // ラーメン（英語・ローマ字追加）
    "一蘭", "ichiran",
    "一風堂", "ippudo",
    "天下一品", "tenka ippin", "tenkaippin",
    "日高屋", "hidakaya",
    "幸楽苑", "kourakuen",
  
    // その他大手（既存分）
    "牛角", "gyukaku", "gyu-kaku",
    "しゃぶ葉", "syabuyo", "shabu-yo",
    "焼肉きんぐ", "yakiniku king",
    "串カツ田中", "kushikatsu tanaka",
    "ミスタードーナツ", "mister donut", "ミスド",
    "ドミノ", "domino's pizza", "dominos",
    "ピザハット", "pizza hut",
    "サブウェイ", "subway",
    "サーティワン", "baskin-robbins", "baskin robbins", "31",
    "餃子の王将", "王将", "ohsho", "gyoza no ohsho",
    "coco壱番屋", "coco ichibanya", "ココイチ",
    "松のや", "matsunoya",
    "かつや", "katsuya",
    "てんや", "tenya",
    "ゆず庵", "yuzuan",
  
    // === 2. 【新規追加】未登録だった超メジャーチェーン ===
    
    // 定食・和食・丼系
    "やよい軒", "yayoiken",
    "大戸屋", "ootoya", "ootoya gohan dokoro",
    "和食さと", "washoku sato",
    "山田うどん", "yamada udon",
    "なか卯", "nakau",
    
    // ファミレス・中華系
    "バーミヤン", "bamiyan",
    "ジョイフル", "joyfull",
    "ステーキ宮", "steak miya",
    "いきなりステーキ", "ikinari steak",
    "ブロンコビリー", "bronco billy",
    
    // カフェ・デザート系追加
    "サンマルクカフェ", "st. marc cafe", "st.marc cafe",
    "星乃珈琲店", "星乃珈琲", "hoshino coffee",
    "上島珈琲店", "上島珈琲", "ueshima coffee",
    "カフェ・ド・クリエ", "cafe de crie",
    "ゴンチャ", "gong cha", "gongcha",
    
    // ラーメン系追加（ここがすり抜けると致命的）
    "山岡家", "yamaokaya", "ラーメン山岡家", // 地方のロードサイド爆撃対策
    "ラーメンショップ", "ramen shop", "ラーショ",
    "町田商店", "machida shoten",
    "魁力屋", "kairikiya",
    "来来亭", "rairaitei",
    "喜多方ラーメン坂内", "bannai",
    
    // 居酒屋・その他全国チェーン
    "鳥貴族", "torikizoku", "トリキ",
    "磯丸水産", "isomaru suisan", "isomaru",
    "世界の山ちゃん", "sekai no yamachan",
    "つぼ八", "tsubohachi",
    "魚民", "uotami",
    "白木屋", "shirokiya",
    "笑笑", "warawara",
    "木曽路", "kisoji"
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
