// 経由地を回る順番を、プログラムで計算して決める（以前は AI に任せていた部分）

import { distanceKm, type Place } from './geo';

// 配列の並べ方（順列）をすべて作る。経由地は最大8件なので 8! = 40,320 通りで十分速い
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

function totalDistance(path: Place[]): number {
  let sum = 0;
  for (let i = 0; i < path.length - 1; i++) sum += distanceKm(path[i], path[i + 1]);
  return sum;
}

// 出発地と終着地は固定し、経由地の順番だけを入れ替えて、合計距離が最短になる並びを返す
export function findShortestOrder(start: Place, waypoints: Place[], end: Place): Place[] {
  let best: Place[] = [start, ...waypoints, end];
  let bestDistance = totalDistance(best);

  for (const order of permutations(waypoints)) {
    const path = [start, ...order, end];
    const d = totalDistance(path);
    if (d < bestDistance) {
      best = path;
      bestDistance = d;
    }
  }
  return best;
}
