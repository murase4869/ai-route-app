import 'dotenv/config'; // .env ファイルの中身を process.env に読み込む（一番最初に実行する）
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { serve } from '@hono/node-server';
import { geocode, distanceKm, type Place } from './lib/geo';
import { findShortestOrder } from './lib/optimize';
import { routeRequestSchema } from './lib/validate';
import { rateLimit } from './lib/rateLimit';
import { suggestTransport } from './lib/gemini';

// 起動時に API キーを確認し、無ければその場で止める（動いているのに使えない状態を防ぐ）
const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error('GEMINI_API_KEY が設定されていません。backend/.env.example を参考に .env を作成してください。');
  process.exit(1);
}

// 許可するフロントエンドの URL だけを CORS で通す
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = new Hono();

app.use('*', secureHeaders());
app.use(
  '/api/*',
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);

app.get('/', (c) => c.text('AI Route API is running'));

app.post(
  '/api/route',
  bodyLimit({ maxSize: 10 * 1024, onError: (c) => c.json({ error: 'リクエストが大きすぎます。' }, 413) }),
  rateLimit({ max: 10, windowMs: 10 * 60 * 1000 }), // 1人あたり10分に10回まで
  async (c) => {
    // 1. 入力を検査する
    const body = await c.req.json().catch(() => null);
    const parsed = routeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? '入力が正しくありません。' }, 400);
    }
    const { startPoint, endPoint, destinations, modePreference } = parsed.data;

    try {
      // 2. 地名を緯度経度に変換する（プログラム）
      const names = [startPoint, ...destinations, endPoint];
      const places: Place[] = [];
      for (const name of names) {
        const place = await geocode(name);
        if (!place) {
          return c.json({ error: `「${name}」の場所が見つかりませんでした。別の書き方を試してください。` }, 422);
        }
        places.push(place);
      }

      // 3. 距離が最短になる回り方を計算する（プログラム）
      const ordered = findShortestOrder(places[0], places.slice(1, -1), places[places.length - 1]);
      const legs = ordered.slice(0, -1).map((from, i) => ({
        from: from.name,
        to: ordered[i + 1].name,
        distanceKm: Math.round(distanceKm(from, ordered[i + 1]) * 10) / 10,
      }));

      const totalKm = Math.round(legs.reduce((total, leg) => total + leg.distanceKm, 0) * 10) / 10;

      // 4. 各区間の移動手段・時間・費用の見積もりだけを AI に頼む
      //    AI が失敗しても、プログラムで計算した順番と距離は返す
      let ai;
      try {
        ai = await suggestTransport(apiKey, legs, modePreference);
      } catch (error) {
        console.error('AI suggestion failed:', error);
        return c.json({ stops: ordered, legs, totals: { distanceKm: totalKm }, ai: null });
      }

      // 5. 合計はプログラムで計算する
      const aiLegs = legs.map((leg, i) => ({ ...leg, ...ai.legs[i] }));
      return c.json({
        stops: ordered,
        legs: aiLegs,
        totals: {
          distanceKm: totalKm,
          minutes: aiLegs.reduce((total, leg) => total + leg.estimatedMinutes, 0),
          costYen: aiLegs.reduce((total, leg) => total + leg.costYen, 0),
        },
        ai: { summary: ai.summary },
      });
    } catch (error) {
      // 詳しい原因はサーバーのログにだけ出し、利用者には一般的なメッセージを返す
      console.error('Route generation failed:', error);
      return c.json({ error: 'ルートの生成に失敗しました。時間をおいて再度お試しください。' }, 500);
    }
  },
);

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`Server is running on http://localhost:${port}`);
console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
