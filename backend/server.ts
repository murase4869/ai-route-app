import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GoogleGenAI, Type } from '@google/genai';
import { serve } from '@hono/node-server';

const app = new Hono();

// 【CORSエラー完全回避設定】フロントエンドからのリクエストをすべて許可します
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ⚠️ あなたのGemini APIキー（AIzaSy...）をここに貼り付けてください
const ai = new GoogleGenAI({ apiKey: 'AIzaSyAutSs7pVDUNZHp4hwo449b4uJSaOjkgOc' });

app.post('/api/route', async (c) => {
  try {
    const { destinations, modePreference } = await c.req.json<{
      destinations: string[];
      modePreference: 'balanced' | 'fastest' | 'cheapest';
    }>();

    if (!destinations || destinations.length < 2) {
      return c.json({ error: '目的地を2つ以上入力してください。' }, 400);
    }

    // AIの返却フォーマットを厳密に定義（フロントエンドのApp.tsxと完全に一致）
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        optimizedOrder: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: '効率的な順に並び替えた目的地名の配列'
        },
        routes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              from: { type: Type.STRING },
              to: { type: Type.STRING },
              transportMode: { type: Type.STRING, description: '最適な移動手段（例：電車、徒歩など）' },
              estimatedTime: { type: Type.STRING, description: '移動時間の目安（例：約15分）' },
              cost: { type: Type.STRING, description: '費用の目安（例：300円、0円など）' },
              memo: { type: Type.STRING, description: 'その手段を選んだ理由やアドバイス' }
            },
            required: ['from', 'to', 'transportMode', 'estimatedTime', 'memo']
          }
        },
        totalSummary: { type: Type.STRING, description: 'ルート全体に対するAIの総評' }
      },
      required: ['optimizedOrder', 'routes', 'totalSummary']
    };

    const prompt = `
    あなたは移動ルート最適化のエキスパートです。
    提供された以下の目的地リストを地理的位置関係や一般的な交通の便を考慮して、最も効率的に巡回できる順番に並び替えてください。
    また、各区間の移動手段（電車、車、自転車、徒歩など）を適切に選択してください。

    【条件】
    - 目的地リスト: ${destinations.join(', ')}
    - 優先方針: ${modePreference} (balanced=快適さと効率のバランス, fastest=最短時間, cheapest=最安費用)
    `;

    // 賢くて高速な最新モデル「gemini-2.5-flash」を呼び出し
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('AIからのレスポンスが空でした。');
    }

    // 生成されたJSONをそのままフロントに返す
    return c.json(JSON.parse(responseText));

  } catch (error: any) {
    console.error('バックエンド内部エラー:', error);
    return c.json({ error: 'AIルート生成に失敗しました。詳細: ' + error.message }, 500);
  }
});

// 3000番ポートでHonoサーバーを待機状態にする
serve({ fetch: app.fetch, port: 3000 });
console.log('🚀 AI Server is running on http://localhost:3000');