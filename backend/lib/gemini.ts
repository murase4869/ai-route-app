// AI には「各区間の移動手段・時間・費用の見積もり」だけを頼む（距離と順番はプログラムで計算済み）

import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';
import { z } from 'zod';

export const TRANSPORT_MODES = ['徒歩', '自転車', '電車', 'バス', '車', 'タクシー'] as const;

export type LegInput = { from: string; to: string; distanceKm: number };
type Preference = 'balanced' | 'fastest' | 'cheapest';

const PREFERENCE_TEXT: Record<Preference, string> = {
  balanced: '快適さと効率のバランス',
  fastest: '所要時間の短さを最優先',
  cheapest: '費用の安さを最優先',
};

// AI に「この形の JSON だけを返して」と指定する（構造化出力）
const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    legs: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          transportMode: { type: SchemaType.STRING, format: 'enum', enum: [...TRANSPORT_MODES] },
          estimatedMinutes: { type: SchemaType.INTEGER },
          costYen: { type: SchemaType.INTEGER },
          memo: { type: SchemaType.STRING },
        },
        required: ['transportMode', 'estimatedMinutes', 'costYen', 'memo'],
      },
    },
    summary: { type: SchemaType.STRING },
  },
  required: ['legs', 'summary'],
};

// AI の返事も信用せず、zod でもう一度検査する
const aiResultSchema = z.object({
  legs: z.array(
    z.object({
      transportMode: z.enum(TRANSPORT_MODES),
      estimatedMinutes: z.number().int().nonnegative(),
      costYen: z.number().int().nonnegative(),
      memo: z.string(),
    }),
  ),
  summary: z.string(),
});

export type AiResult = z.infer<typeof aiResultSchema>;

// 混雑(503)や回数制限(429)は一時的なことが多いので、少し待ってやり直す
async function withRetry<T>(task: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      const status = (error as { status?: number }).status;
      const temporary = status === 503 || status === 429;
      if (!temporary || attempt >= retries) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); // 1秒, 2秒 と間隔を広げる
    }
  }
}

export async function suggestTransport(apiKey: string, legs: LegInput[], preference: Preference): Promise<AiResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json', responseSchema },
  });

  // ユーザーの入力は JSON データとして渡し、命令文とは分けておく
  const prompt = `あなたは日本国内の移動手段アドバイザーです。
以下の各区間について、移動手段・所要時間(分)・費用(円)を見積もり、選んだ理由を短く書いてください。
区間の順番と距離は計算済みなので変更しないでください。legs は入力と同じ数・同じ順番で返してください。
summary には全体へのアドバイスを2〜3文で書いてください。
優先方針: ${PREFERENCE_TEXT[preference]}
距離は直線距離です。実際の道のりはこれより長くなることを考慮してください。
区間データ(JSON): ${JSON.stringify(legs)}`;

  const result = await withRetry(() => model.generateContent(prompt));
  const parsed = aiResultSchema.parse(JSON.parse(result.response.text()));

  if (parsed.legs.length !== legs.length) {
    throw new Error(`AI returned ${parsed.legs.length} legs, expected ${legs.length}`);
  }
  return parsed;
}
