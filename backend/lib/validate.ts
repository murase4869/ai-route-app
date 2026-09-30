// フロントエンドから届いたデータが正しい形か検査する（届いたデータは信用しないのが基本）

import { z } from 'zod';

export const MAX_WAYPOINTS = 8;

// 前後の空白を削り、改行などの制御文字を取り除く（プロンプトに命令文を紛れ込ませにくくする）
const placeName = z
  .string()
  .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim())
  .pipe(z.string().min(1, '出発地点と終着地点を入力してください。').max(50, '地名は50文字以内で入力してください。'));

export const routeRequestSchema = z.object({
  startPoint: placeName,
  endPoint: placeName,
  destinations: z
    .array(z.string())
    .default([])
    .transform((list) => list.map((s) => s.trim()).filter((s) => s !== ''))
    .pipe(z.array(placeName).max(MAX_WAYPOINTS, `経由地は${MAX_WAYPOINTS}件までです。`)),
  modePreference: z.enum(['balanced', 'fastest', 'cheapest']).default('balanced'),
});

export type RouteRequest = z.infer<typeof routeRequestSchema>;
