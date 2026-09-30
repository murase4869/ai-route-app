import type { Leg, RouteResponse } from '../api';
import RouteMap from './RouteMap';

const TRANSPORT_ICONS: Record<string, string> = {
  徒歩: '🚶',
  自転車: '🚲',
  電車: '🚃',
  バス: '🚌',
  車: '🚗',
  タクシー: '🚕',
};

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}時間${m > 0 ? `${m}分` : ''}` : `${m}分`;
}

const formatYen = (yen: number) => `¥${yen.toLocaleString('ja-JP')}`;

function LegCard({ leg }: { leg: Leg }) {
  return (
    <li className="leg">
      <div className="leg__mode">
        <span className="leg__icon" aria-hidden="true">
          {leg.transportMode ? TRANSPORT_ICONS[leg.transportMode] ?? '➡️' : '➡️'}
        </span>
        <strong>{leg.transportMode ?? '移動'}</strong>
      </div>
      <dl className="leg__facts">
        <div>
          <dt>距離</dt>
          <dd>{leg.distanceKm} km</dd>
        </div>
        {leg.estimatedMinutes !== undefined && (
          <div>
            <dt>時間</dt>
            <dd>{formatMinutes(leg.estimatedMinutes)}</dd>
          </div>
        )}
        {leg.costYen !== undefined && (
          <div>
            <dt>費用</dt>
            <dd>{formatYen(leg.costYen)}</dd>
          </div>
        )}
      </dl>
      {leg.memo && <p className="leg__memo">{leg.memo}</p>}
    </li>
  );
}

export default function RouteResult({ result }: { result: RouteResponse }) {
  const { stops, legs, totals, ai } = result;

  return (
    <section className="result" aria-label="検索結果">
      <div className="stats">
        <div className="stat">
          <span className="stat__label">総距離（直線）</span>
          <span className="stat__value">{totals.distanceKm} km</span>
        </div>
        <div className="stat">
          <span className="stat__label">合計時間</span>
          <span className="stat__value">{totals.minutes !== undefined ? formatMinutes(totals.minutes) : '—'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">合計費用</span>
          <span className="stat__value">{totals.costYen !== undefined ? formatYen(totals.costYen) : '—'}</span>
        </div>
      </div>

      <div className="card card--flush">
        <RouteMap stops={stops} />
      </div>

      {ai ? (
        <div className="card advice">
          <h2>AIからのアドバイス</h2>
          <p>{ai.summary}</p>
        </div>
      ) : (
        <div className="notice" role="status">
          AIの見積もりを取得できなかったため、プログラムで計算した順番と距離だけを表示しています。
        </div>
      )}

      <ol className="card timeline">
        {stops.map((stop, i) => {
          const isStart = i === 0;
          const isEnd = i === stops.length - 1;
          return (
            <li key={i} className="timeline__item">
              <div className="timeline__stop">
                <span className={`stop-dot ${isStart ? 'stop-dot--start' : isEnd ? 'stop-dot--end' : ''}`} aria-hidden="true">
                  {isStart ? 'S' : isEnd ? 'G' : i}
                </span>
                <div>
                  <strong>{stop.name}</strong>
                  {stop.displayName !== stop.name && <span className="hint"> {stop.displayName}</span>}
                </div>
              </div>
              {!isEnd && (
                <ul className="timeline__leg">
                  <LegCard leg={legs[i]} />
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <p className="hint center">
        順番と距離はプログラムで計算した直線距離によるものです。時間と費用はAIによる推定なので、実際とは異なる場合があります。
      </p>
    </section>
  );
}
