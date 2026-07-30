export interface Municipality {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Prefecture {
  id: string;
  name: string;
  municipalities: Municipality[];
}

/** Static centroids for manual location pick (no geocoding API). */
export const JAPAN_PREFECTURES: Prefecture[] = [
  { id: "hokkaido", name: "Hokkaido", municipalities: [
    { id: "sapporo", name: "Sapporo", lat: 43.0618, lng: 141.3545 },
    { id: "hakodate", name: "Hakodate", lat: 41.7688, lng: 140.7288 },
    { id: "asahikawa", name: "Asahikawa", lat: 43.7706, lng: 142.3650 },
  ]},
  { id: "aomori", name: "Aomori", municipalities: [
    { id: "aomori-city", name: "Aomori", lat: 40.8243, lng: 140.7400 },
    { id: "hachinohe", name: "Hachinohe", lat: 40.5122, lng: 141.4883 },
  ]},
  { id: "iwate", name: "Iwate", municipalities: [
    { id: "morioka", name: "Morioka", lat: 39.7036, lng: 141.1527 },
  ]},
  { id: "miyagi", name: "Miyagi", municipalities: [
    { id: "sendai", name: "Sendai", lat: 38.2682, lng: 140.8694 },
  ]},
  { id: "akita", name: "Akita", municipalities: [
    { id: "akita-city", name: "Akita", lat: 39.7200, lng: 140.1026 },
  ]},
  { id: "yamagata", name: "Yamagata", municipalities: [
    { id: "yamagata-city", name: "Yamagata", lat: 38.2404, lng: 140.3633 },
  ]},
  { id: "fukushima", name: "Fukushima", municipalities: [
    { id: "fukushima-city", name: "Fukushima", lat: 37.7608, lng: 140.4747 },
    { id: "koriyama", name: "Koriyama", lat: 37.4006, lng: 140.3596 },
  ]},
  { id: "ibaraki", name: "Ibaraki", municipalities: [
    { id: "mito", name: "Mito", lat: 36.3418, lng: 140.4468 },
    { id: "tsukuba", name: "Tsukuba", lat: 36.0833, lng: 140.0766 },
  ]},
  { id: "tochigi", name: "Tochigi", municipalities: [
    { id: "utsunomiya", name: "Utsunomiya", lat: 36.5551, lng: 139.8828 },
  ]},
  { id: "gunma", name: "Gunma", municipalities: [
    { id: "maebashi", name: "Maebashi", lat: 36.3895, lng: 139.0634 },
    { id: "takasaki", name: "Takasaki", lat: 36.3220, lng: 139.0033 },
  ]},
  { id: "saitama", name: "Saitama", municipalities: [
    { id: "saitama-city", name: "Saitama", lat: 35.8617, lng: 139.6455 },
    { id: "kawagoe", name: "Kawagoe", lat: 35.9251, lng: 139.4858 },
  ]},
  { id: "chiba", name: "Chiba", municipalities: [
    { id: "chiba-city", name: "Chiba", lat: 35.6074, lng: 140.1065 },
    { id: "funabashi", name: "Funabashi", lat: 35.6947, lng: 139.9825 },
  ]},
  { id: "tokyo", name: "Tokyo", municipalities: [
    { id: "shibuya", name: "Shibuya", lat: 35.6580, lng: 139.7016 },
    { id: "shinjuku", name: "Shinjuku", lat: 35.6938, lng: 139.7034 },
    { id: "ikebukuro", name: "Ikebukuro", lat: 35.7295, lng: 139.7109 },
    { id: "ginza", name: "Ginza", lat: 35.6717, lng: 139.7650 },
  ]},
  { id: "kanagawa", name: "Kanagawa", municipalities: [
    { id: "yokohama", name: "Yokohama", lat: 35.4437, lng: 139.6380 },
    { id: "kawasaki", name: "Kawasaki", lat: 35.5309, lng: 139.7030 },
  ]},
  { id: "niigata", name: "Niigata", municipalities: [
    { id: "niigata-city", name: "Niigata", lat: 37.9026, lng: 139.0236 },
  ]},
  { id: "toyama", name: "Toyama", municipalities: [
    { id: "toyama-city", name: "Toyama", lat: 36.6953, lng: 137.2113 },
  ]},
  { id: "ishikawa", name: "Ishikawa", municipalities: [
    { id: "kanazawa", name: "Kanazawa", lat: 36.5613, lng: 136.6562 },
  ]},
  { id: "fukui", name: "Fukui", municipalities: [
    { id: "fukui-city", name: "Fukui", lat: 36.0652, lng: 136.2216 },
  ]},
  { id: "yamanashi", name: "Yamanashi", municipalities: [
    { id: "kofu", name: "Kofu", lat: 35.6642, lng: 138.5684 },
  ]},
  { id: "nagano", name: "Nagano", municipalities: [
    { id: "nagano-city", name: "Nagano", lat: 36.6513, lng: 138.1810 },
    { id: "matsumoto", name: "Matsumoto", lat: 36.2380, lng: 137.9720 },
  ]},
  { id: "gifu", name: "Gifu", municipalities: [
    { id: "gifu-city", name: "Gifu", lat: 35.4233, lng: 136.7607 },
    { id: "takayama", name: "Takayama", lat: 36.1460, lng: 137.2520 },
  ]},
  { id: "shizuoka", name: "Shizuoka", municipalities: [
    { id: "shizuoka-city", name: "Shizuoka", lat: 34.9756, lng: 138.3828 },
    { id: "hamamatsu", name: "Hamamatsu", lat: 34.7108, lng: 137.7262 },
  ]},
  { id: "aichi", name: "Aichi", municipalities: [
    { id: "nagoya", name: "Nagoya", lat: 35.1815, lng: 136.9066 },
  ]},
  { id: "mie", name: "Mie", municipalities: [
    { id: "tsu", name: "Tsu", lat: 34.7303, lng: 136.5086 },
    { id: "ise", name: "Ise", lat: 34.4874, lng: 136.7094 },
  ]},
  { id: "shiga", name: "Shiga", municipalities: [
    { id: "otsu", name: "Otsu", lat: 35.0045, lng: 135.8686 },
  ]},
  { id: "kyoto", name: "Kyoto", municipalities: [
    { id: "kyoto-city", name: "Kyoto", lat: 35.0116, lng: 135.7681 },
  ]},
  { id: "osaka", name: "Osaka", municipalities: [
    { id: "osaka-city", name: "Osaka", lat: 34.6937, lng: 135.5023 },
    { id: "namba", name: "Namba", lat: 34.6654, lng: 135.5020 },
  ]},
  { id: "hyogo", name: "Hyogo", municipalities: [
    { id: "kobe", name: "Kobe", lat: 34.6901, lng: 135.1956 },
    { id: "himeji", name: "Himeji", lat: 34.8151, lng: 134.6854 },
  ]},
  { id: "nara", name: "Nara", municipalities: [
    { id: "nara-city", name: "Nara", lat: 34.6851, lng: 135.8048 },
  ]},
  { id: "wakayama", name: "Wakayama", municipalities: [
    { id: "wakayama-city", name: "Wakayama", lat: 34.2261, lng: 135.1675 },
  ]},
  { id: "tottori", name: "Tottori", municipalities: [
    { id: "tottori-city", name: "Tottori", lat: 35.5036, lng: 134.2383 },
  ]},
  { id: "shimane", name: "Shimane", municipalities: [
    { id: "matsue", name: "Matsue", lat: 35.4723, lng: 133.0505 },
  ]},
  { id: "okayama", name: "Okayama", municipalities: [
    { id: "okayama-city", name: "Okayama", lat: 34.6555, lng: 133.9195 },
  ]},
  { id: "hiroshima", name: "Hiroshima", municipalities: [
    { id: "hiroshima-city", name: "Hiroshima", lat: 34.3853, lng: 132.4553 },
  ]},
  { id: "yamaguchi", name: "Yamaguchi", municipalities: [
    { id: "yamaguchi-city", name: "Yamaguchi", lat: 34.1785, lng: 131.4737 },
  ]},
  { id: "tokushima", name: "Tokushima", municipalities: [
    { id: "tokushima-city", name: "Tokushima", lat: 34.0658, lng: 134.5593 },
  ]},
  { id: "kagawa", name: "Kagawa", municipalities: [
    { id: "takamatsu", name: "Takamatsu", lat: 34.3401, lng: 134.0434 },
  ]},
  { id: "ehime", name: "Ehime", municipalities: [
    { id: "matsuyama", name: "Matsuyama", lat: 33.8392, lng: 132.7657 },
  ]},
  { id: "kochi", name: "Kochi", municipalities: [
    { id: "kochi-city", name: "Kochi", lat: 33.5597, lng: 133.5311 },
  ]},
  { id: "fukuoka", name: "Fukuoka", municipalities: [
    { id: "fukuoka-city", name: "Fukuoka", lat: 33.5904, lng: 130.4017 },
  ]},
  { id: "saga", name: "Saga", municipalities: [
    { id: "saga-city", name: "Saga", lat: 33.2494, lng: 130.2989 },
  ]},
  { id: "nagasaki", name: "Nagasaki", municipalities: [
    { id: "nagasaki-city", name: "Nagasaki", lat: 32.7503, lng: 129.8779 },
  ]},
  { id: "kumamoto", name: "Kumamoto", municipalities: [
    { id: "kumamoto-city", name: "Kumamoto", lat: 32.8031, lng: 130.7079 },
  ]},
  { id: "oita", name: "Oita", municipalities: [
    { id: "oita-city", name: "Oita", lat: 33.2382, lng: 131.6126 },
    { id: "beppu", name: "Beppu", lat: 33.2794, lng: 131.4972 },
  ]},
  { id: "miyazaki", name: "Miyazaki", municipalities: [
    { id: "miyazaki-city", name: "Miyazaki", lat: 31.9077, lng: 131.4202 },
  ]},
  { id: "kagoshima", name: "Kagoshima", municipalities: [
    { id: "kagoshima-city", name: "Kagoshima", lat: 31.5966, lng: 130.5571 },
  ]},
  { id: "okinawa", name: "Okinawa", municipalities: [
    { id: "naha", name: "Naha", lat: 26.2124, lng: 127.6792 },
  ]},
];
