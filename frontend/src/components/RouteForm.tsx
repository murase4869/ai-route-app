import { useId, useState } from 'react';
import type { Preference, RouteRequest } from '../api';

const MAX_WAYPOINTS = 8;

const PREFERENCES: { value: Preference; label: string }[] = [
  { value: 'balanced', label: 'バランス' },
  { value: 'fastest', label: '時間重視' },
  { value: 'cheapest', label: '費用重視' },
];

// 経由地には一意の id を持たせる。配列の番号を key にすると、途中を削除したときに入力欄がずれるため
type Waypoint = { id: number; value: string };
let nextId = 1;
const newWaypoint = (): Waypoint => ({ id: nextId++, value: '' });

type Props = {
  loading: boolean;
  onSubmit: (request: RouteRequest) => void;
};

export default function RouteForm({ loading, onSubmit }: Props) {
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() => [newWaypoint()]);
  const [preference, setPreference] = useState<Preference>('balanced');
  const id = useId(); // <label> と <input> を結びつけるための一意な id

  const updateWaypoint = (targetId: number, value: string) =>
    setWaypoints(waypoints.map((w) => (w.id === targetId ? { ...w, value } : w)));
  const removeWaypoint = (targetId: number) => setWaypoints(waypoints.filter((w) => w.id !== targetId));
  const addWaypoint = () => setWaypoints([...waypoints, newWaypoint()]);

  const swapEnds = () => {
    setStartPoint(endPoint);
    setEndPoint(startPoint);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      startPoint: startPoint.trim(),
      endPoint: endPoint.trim(),
      destinations: waypoints.map((w) => w.value.trim()).filter(Boolean),
      modePreference: preference,
    });
  };

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <div className="stop-field">
        <span className="stop-dot stop-dot--start" aria-hidden="true">S</span>
        <div className="field">
          <label htmlFor={`${id}-start`}>出発地点</label>
          <input
            id={`${id}-start`}
            value={startPoint}
            onChange={(e) => setStartPoint(e.target.value)}
            placeholder="例: 名古屋駅"
            maxLength={50}
            required
          />
        </div>
      </div>

      <fieldset className="waypoints">
        <legend>
          経由地 <span className="hint">順番は自動で最適化されます（最大{MAX_WAYPOINTS}件）</span>
        </legend>
        {waypoints.map((w, i) => (
          <div className="stop-field" key={w.id}>
            <span className="stop-dot" aria-hidden="true">{i + 1}</span>
            <div className="field field--row">
              <label htmlFor={`${id}-wp-${w.id}`} className="visually-hidden">
                経由地 {i + 1}
              </label>
              <input
                id={`${id}-wp-${w.id}`}
                value={w.value}
                onChange={(e) => updateWaypoint(w.id, e.target.value)}
                placeholder="例: 大須観音"
                maxLength={50}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => removeWaypoint(w.id)}
                aria-label={`経由地 ${i + 1} を削除`}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-button"
          onClick={addWaypoint}
          disabled={waypoints.length >= MAX_WAYPOINTS}
        >
          ＋ 経由地を追加
        </button>
      </fieldset>

      <div className="stop-field">
        <span className="stop-dot stop-dot--end" aria-hidden="true">G</span>
        <div className="field field--row">
          <div className="field">
            <label htmlFor={`${id}-end`}>終着地点</label>
            <input
              id={`${id}-end`}
              value={endPoint}
              onChange={(e) => setEndPoint(e.target.value)}
              placeholder="例: 中京大学"
              maxLength={50}
              required
            />
          </div>
          <button type="button" className="icon-button icon-button--swap" onClick={swapEnds} aria-label="出発地点と終着地点を入れ替え">
            ⇅
          </button>
        </div>
      </div>

      <fieldset className="segmented">
        <legend>優先方針</legend>
        <div className="segmented__options">
          {PREFERENCES.map((p) => (
            <label key={p.value} className="segmented__option">
              <input
                type="radio"
                name={`${id}-preference`}
                value={p.value}
                checked={preference === p.value}
                onChange={() => setPreference(p.value)}
              />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="primary-button" disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" aria-hidden="true" /> 検索中…
          </>
        ) : (
          'ルートを検索'
        )}
      </button>
      {loading && <p className="hint center">場所の検索とAIの見積もりに10〜20秒ほどかかることがあります</p>}
    </form>
  );
}
