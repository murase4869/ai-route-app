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

    // 💡 APIキーのクリーンアップ（見えない空白や記号を徹底排除）
    const apiKey = (process.env.GEMINI_API_KEY || '').replace(/['"]/g, '').trim();
    if (!apiKey) {
      throw new Error('サーバーにAPIキーが設定されていません。');
    }

    const waypoints = destinations && destinations.length > 0 ? destinations.join(', ') : 'なし（直行）';

    // 💡 プロンプト内で直接JSONの形を厳格に指定する
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

    // 💡 確実に動作する v1beta エンドポイントを使用
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // 💡 余計な設定（generationConfig）をすべて排除し、最もシンプルな形に
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("【Google APIエラー詳細】:", JSON.stringify(data, null, 2));
      throw new Error(`Google API Error: ${data.error?.message || response.statusText}`);
    }

    // ✅ 本物のAIからの返答を取得し、万が一のマークダウン記号を削除してパース
    let responseText = data.candidates[0].content.parts[0].text;
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return c.json(JSON.parse(responseText));

  } catch (error: any) {
    console.error('バックエンド内部エラー:', error);
    return c.json({ error: 'AIルート生成に失敗しました。詳細: ' + error.message }, 500);
  }
});

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`🚀 AI Server is running on port ${port} (REST API Mode)`);