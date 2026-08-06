import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';

const app = new Hono();

// CORS設定
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (c) => c.text('AI Route API is running!'));
app.get('/api/route', (c) => c.json({ message: 'Use POST method to generate routes.' }));

app.post('/api/route', async (c) => {
  try {
    const { startPoint, endPoint, destinations, modePreference } = await c.req.json<{
      startPoint: string;
      endPoint: string;
      destinations: string[];
      modePreference: 'balanced' | 'fastest' | 'cheapest';
    }>();

    if (!startPoint || !endPoint) {
      return c.json({ error: '出発地点と終着地点を入力してください。' }, 400);
    }

    // 環境変数からAPIキーを取得
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('サーバーにAPIキーが設定されていません。');
    }

    const waypoints = destinations && destinations.length > 0 ? destinations.join(', ') : 'なし（直行）';

    const prompt = `
    あなたは移動ルート最適化のエキスパートです。
    提供された「出発地点」「経由地」「終着地点」をもとに、地理的位置関係や一般的な交通の便を考慮して、最も効率的に移動できるルートを提案してください。

    【移動条件】
    - 出発地点: ${startPoint}
    - 経由地: ${waypoints}
    - 終着地点: ${endPoint}
    - 優先方針: ${modePreference} (balanced=快適さと効率のバランス, fastest=最短時間, cheapest=最安費用)

    ※経由地が「なし（直行）」の場合は、出発地点から終着地点へ直接向かう最適なルートを出力してください。
    `;

    // 💡 確実に動作し、JSONスキーマに対応している最新の「gemini-1.5-flash」を使用します
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            optimizedOrder: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "効率的な順に並び替えた地点名の配列（出発地〜経由地〜終着地）"
            },
            routes: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  from: { type: "STRING" },
                  to: { type: "STRING" },
                  transportMode: { type: "STRING", description: "最適な移動手段（例：電車、徒歩など）" },
                  estimatedTime: { type: "STRING", description: "移動時間の目安" },
                  cost: { type: "STRING", description: "費用の目安" },
                  memo: { type: "STRING", description: "その手段を選んだ理由やアドバイス" }
                },
                required: ["from", "to", "transportMode", "estimatedTime", "memo"]
              }
            },
            totalSummary: { type: "STRING", description: "ルート全体に対するAIの総評" }
          },
          required: ["optimizedOrder", "routes", "totalSummary"]
        }
      }
    };

    // 💡 POSTメソッドを明示的に指定して送信（これが一番の解決策です）
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // ⛔ Google側からエラーが返ってきた場合
    if (!response.ok) {
      console.error("Google APIからの詳細エラー:", JSON.stringify(data, null, 2));
      throw new Error(`Google API Error: ${data.error?.message || response.statusText}`);
    }

    // ✅ 成功時：AIのテキスト（JSON文字列）を取得して返す
    const responseText = data.candidates[0].content.parts[0].text;
    return c.json(JSON.parse(responseText));

  } catch (error: any) {
    console.error('バックエンド内部エラー:', error);
    return c.json({ error: 'AIルート生成に失敗しました。詳細: ' + error.message }, 500);
  }
});

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`🚀 AI Server is running on port ${port} (REST API Mode)`);