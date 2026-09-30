// バックエンドとの通信と、やり取りするデータの型をまとめたファイル

export type Preference = 'balanced' | 'fastest' | 'cheapest';

export type Stop = {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
};

export type Leg = {
  from: string;
  to: string;
  distanceKm: number; // プログラムが計算した直線距離
  // ここから下は AI の見積もり（AI が失敗したときは無い）
  transportMode?: string;
  estimatedMinutes?: number;
  costYen?: number;
  memo?: string;
};

export type RouteResponse = {
  stops: Stop[];
  legs: Leg[];
  totals: { distanceKm: number; minutes?: number; costYen?: number };
  ai: { summary: string } | null;
};

export type RouteRequest = {
  startPoint: string;
  endPoint: string;
  destinations: string[];
  modePreference: Preference;
};

// 接続先は環境変数 VITE_API_URL で切り替える（未設定なら 開発=ローカル / 本番=Render）
const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? 'https://ai-route-app.onrender.com' : 'http://localhost:3000');

export async function fetchRoute(request: RouteRequest): Promise<RouteResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error('サーバーに接続できませんでした。時間をおいて再度お試しください。');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // サーバーが返したエラーメッセージ（「〇〇が見つかりません」など）をそのまま見せる
    throw new Error(data?.error ?? `エラーが発生しました（${res.status}）`);
  }
  return data as RouteResponse;
}
