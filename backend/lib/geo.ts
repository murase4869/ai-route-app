// 地名 → 緯度経度（ジオコーディング）と、2点間の距離計算を担当する

export type Place = {
  name: string; // ユーザーが入力した名前
  displayName: string; // 検索サービスが返した正式名称
  lat: number;
  lng: number;
};

const USER_AGENT = 'ai-route-app (study project; https://github.com/syoutamurase/ai-route-app)';

// 同じ地名を何度も調べないように、結果をメモリに保存しておく
const cache = new Map<string, Place>();

// Nominatim の利用規約は「1秒に1回まで」なので、呼び出しを順番待ちさせる
let queue: Promise<unknown> = Promise.resolve();
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => undefined).then(() => new Promise((r) => setTimeout(r, 1100)));
  return run;
}

async function searchNominatim(name: string): Promise<Place | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q: name,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'jp',
    'accept-language': 'ja',
  }).toString();

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { lat: string; lon: string; name?: string; display_name: string }[];
  if (data.length === 0) return null;
  return {
    name,
    displayName: data[0].name || data[0].display_name,
    lat: Number(data[0].lat),
    lng: Number(data[0].lon),
  };
}

// 予備: 国土地理院の住所検索（Nominatim で見つからない住所向け）
async function searchGsi(name: string): Promise<Place | null> {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(name)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    geometry: { coordinates: [number, number] };
    properties: { title: string };
  }[];
  // 入力をそのまま含む候補を優先する（「中京大学」で「京都市中京区」を拾わないため）
  const hit = data.find((f) => f.properties.title.includes(name)) ?? data[0];
  if (!hit) return null;
  const [lng, lat] = hit.geometry.coordinates;
  return { name, displayName: hit.properties.title, lat, lng };
}

export async function geocode(name: string): Promise<Place | null> {
  const cached = cache.get(name);
  if (cached) return cached;

  let place: Place | null = null;
  try {
    place = await throttled(() => searchNominatim(name));
  } catch (e) {
    console.warn('Nominatim failed:', e);
  }
  if (!place) {
    try {
      place = await searchGsi(name);
    } catch (e) {
      console.warn('GSI failed:', e);
    }
  }

  if (place) cache.set(name, place);
  return place;
}

// ハーバーサイン（Haversine）公式: 地球を球とみなして2点間の直線距離[km]を求める
export function distanceKm(a: Place, b: Place): number {
  const R = 6371; // 地球の半径 [km]
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
