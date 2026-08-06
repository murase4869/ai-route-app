import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = new Hono();

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (c) => c.text('AI Route API is running'));
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

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('API key is not set');
    }

    const waypoints = destinations && destinations.length > 0 ? destinations.join(', ') : 'なし（直行）';

    const prompt = `
    あなたは移動ルート最適化のエキスパートです。以下の条件で最適なルートを提案し、指定のJSONフォーマットだけで回答してください。マークダウン（\`\`\`json など）は一切不要です。

    【移動条件】
    - 出発地点: ${startPoint}
    - 経由地: ${waypoints}
    - 終着地点: ${endPoint}
    - 優先方針: ${modePreference} (balanced=快適さと効率のバランス, fastest=最短時間, cheapest=最安費用)

    【出力するJSONフォーマット】
    {
      "optimizedOrder": ["出発地", "経由地", "終着地"],
      "routes": [
        {
          "from": "出発地",
          "to": "到着地",
          "transportMode": "電車",
          "estimatedTime": "30分",
          "cost": "400円",
          "memo": "理由"
        }
      ],
      "totalSummary": "全体の総評"
    }
    `;

    // 新規ユーザーのモデルバージョン制限を回避するため latest を指定
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // マークダウンの除去
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    return c.json(JSON.parse(responseText));

  } catch (error: any) {
    console.error('API Error:', error);
    return c.json({ error: 'ルートの生成に失敗しました。' }, 500);
  }
});

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`Server is running on port ${port}`);