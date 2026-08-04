import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { serve } from '@hono/node-server';

const app = new Hono();

// CORS設定（すべてのオリジンからのリクエストを許可）
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 動作確認（ヘルスチェック）用エンドポイント
app.get('/', (c) => c.text('AI Route API is running!'));
app.get('/api/route', (c) => c.json({ message: 'Use POST method to generate routes.' }));

// APIキー設定
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY が環境変数に設定されていません。');
}
const genAI = new GoogleGenerativeAI(apiKey || '');

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

    const waypoints = destinations && destinations.length > 0 ? destinations.join(', ') : 'なし（直行）';

    // 安定版SDK用のJSONスキーマ定義
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        optimizedOrder: { 
          type: SchemaType.ARRAY, 
          items: { type: SchemaType.STRING },
          description: '効率的な順に並び替えた地点名の配列（出発地〜経由地〜終着地）'
        },
        routes: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              from: { type: SchemaType.STRING },
              to: { type: SchemaType.STRING },
              transportMode: { type: SchemaType.STRING, description: '最適な移動手段（例：電車、徒歩など）' },
              estimatedTime: { type: SchemaType.STRING, description: '移動時間の目安（例：約15分）' },
              cost: { type: SchemaType.STRING, description: '費用の目安（例：300円、0円など）' },
              memo: { type: SchemaType.STRING, description: 'その手段を選んだ理由やアドバイス' }
            },
            required: ['from', 'to', 'transportMode', 'estimatedTime', 'memo']
          }
        },
        totalSummary: { type: SchemaType.STRING, description: 'ルート全体に対するAIの総評' }
      },
      required: ['optimizedOrder', 'routes', 'totalSummary']
    };

    // モデルの取得（安定版の gemini-1.5-flash に設定）
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

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

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    if (!responseText) {
      throw new Error('AIからのレスポンスが空でした。');
    }

    return c.json(JSON.parse(responseText));

  } catch (error: any) {
    console.error('バックエンド内部エラー:', error);
    return c.json({ error: 'AIルート生成に失敗しました。詳細: ' + error.message }, 500);
  }
});

// Render等の環境変数PORT（なければ3000）で起動
const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`🚀 AI Server is running on port ${port}`);