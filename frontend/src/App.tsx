import React, { useState } from 'react';
import './App.css';

interface RouteSegment {
  from: string;
  to: string;
  transportMode: string;
  estimatedTime: string;
  cost?: string;
  memo: string;
}

interface ApiResponse {
  optimizedOrder: string[];
  routes: RouteSegment[];
  totalSummary: string;
}

// 移動手段に応じて絵文字を返す見た目アップ用の関数
const getTransportIcon = (mode: string) => {
  const m = mode.toLowerCase();
  if (m.includes('電車') || m.includes('駅') || m.includes('線')) return '🚃';
  if (m.includes('車') || m.includes('タクシー') || m.includes('ドライブ')) return '🚗';
  if (m.includes('自転車') || m.includes('チャリ') || m.includes('サイクル')) return '🚲';
  if (m.includes('バス')) return '🚌';
  return '🚶'; // デフォルトは徒歩
};

export default function App() {
  // 状態（State）の定義
  const [startPoint, setStartPoint] = useState<string>('');
  const [endPoint, setEndPoint] = useState<string>('');
  const [destinations, setDestinations] = useState<string[]>(['', '', '']);
  const [preference, setPreference] = useState<'balanced' | 'fastest' | 'cheapest'>('balanced');
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...destinations];
    newInputs[index] = value;
    setDestinations(newInputs);
  };

  const addField = () => setDestinations([...destinations, '']);
  const removeField = (index: number) => {
    if (destinations.length > 2) {
      setDestinations(destinations.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    if (!startPoint.trim() || !endPoint.trim()) {
      setErrorMsg('出発地点と終着地点は必ず入力してください。');
      setLoading(false);
      return;
    }

    // 空白の入力を除外
    const filteredDestinations = destinations.filter(d => d.trim() !== '');

    try {
      const res = await fetch('https://ai-route-backend-7vz6.onrender.com/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      startPoint: startPoint.trim(),
      endPoint: endPoint.trim(),
      destinations: filteredDestinations,
      modePreference: preference
    }),
    });

      if (!res.ok) {
        throw new Error(`サーバーエラー: ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('バックエンド（サーバー）との接続に失敗しました。ターミナルでサーバーが起動しているか、またはURLが正しいか確認してください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h2 className="app-title">ルート検索</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">出発地点</label>
          <input
            type="text"
            value={startPoint}
            placeholder="例: 名古屋駅"
            onChange={(e) => setStartPoint(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">経由地</label>
          {destinations.map((dest, i) => (
            <div key={i} className="destination-row">
              <span className="destination-label">経由地 {i + 1}</span>
              <input
                type="text"
                value={dest}
                placeholder="例: 栄、大須観音、東山動植物園"
                onChange={(e) => handleInputChange(i, e.target.value)}
                className="form-input"
              />
              {destinations.length > 2 && (
                <button 
                  type="button" 
                  onClick={() => removeField(i)}
                  className="btn-remove"
                >
                  削除
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="form-group">
          <label className="form-label">終着地点</label>
          <input
            type="text"
            value={endPoint}
            placeholder="例: 中京大学"
            onChange={(e) => setEndPoint(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-footer">
          <button 
            type="button" 
            onClick={addField}
            className="btn-secondary"
          >
            経由地を追加
          </button>

          <div className="preference-group">
            <label className="preference-label">優先方針</label>
            <select 
              value={preference} 
              onChange={(e: any) => setPreference(e.target.value)}
              className="form-select"
            >
              <option value="balanced">バランス</option>
              <option value="fastest">時間重視</option>
              <option value="cheapest">費用重視</option>
            </select>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="btn-primary"
        >
          {loading ? '検索中...' : '検索'}
        </button>
      </form>

      {errorMsg && (
        <div className="alert alert-error">
          <strong>エラー:</strong> {errorMsg}
        </div>
      )}

      {result && (
        <div className="results-container">
          <h3 className="results-title">検索結果</h3>
          
          <div className="recommended-route">
            <strong>推奨経路</strong> 
            <div className="route-order">
              {result.optimizedOrder.join(' → ')}
            </div>
          </div>

          <div className="routes-list">
            {result.routes.map((route, i) => (
              <div key={i} className="route-card">
                <div className="route-header">
                  <span className="route-path">{route.from} → {route.to}</span>
                  <span className="transport-icon">{getTransportIcon(route.transportMode)}</span>
                </div>
                <div className="route-details">
                  <div className="detail-item">
                    <span className="detail-label">移動手段:</span>
                    <strong>{route.transportMode}</strong>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">所要時間:</span>
                    <strong>{route.estimatedTime}</strong>
                  </div>
                  {route.cost && (
                    <div className="detail-item">
                      <span className="detail-label">費用:</span>
                      <strong>{route.cost}</strong>
                    </div>
                  )}
                </div>
                <p className="route-memo">
                  <strong>理由:</strong> {route.memo}
                </p>
              </div>
            ))}
          </div>

          <div className="summary-box">
            <h4 className="summary-title">アドバイス</h4>
            <p className="summary-text">{result.totalSummary}</p>
          </div>
        </div>
      )}
    </div>
  );
}