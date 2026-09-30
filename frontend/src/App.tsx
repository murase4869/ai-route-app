import { useState } from 'react';
import { fetchRoute, type RouteRequest, type RouteResponse } from './api';
import RouteForm from './components/RouteForm';
import RouteResult from './components/RouteResult';
import './App.css';

export default function App() {
  const [result, setResult] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (request: RouteRequest) => {
    if (!request.startPoint || !request.endPoint) {
      setErrorMsg('出発地点と終着地点を入力してください。');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      setResult(await fetchRoute(request));
    } catch (err) {
      setResult(null);
      setErrorMsg(err instanceof Error ? err.message : '予期しないエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>AIルートプランナー</h1>
        <p>行きたい場所を入れるだけで、回る順番と移動手段を提案します</p>
      </header>

      <main className="layout">
        <div className="layout__form">
          <RouteForm loading={loading} onSubmit={handleSubmit} />
          {errorMsg && (
            <div className="error" role="alert">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="layout__result">
          {result ? (
            <RouteResult result={result} />
          ) : (
            <div className="card empty">
              <span className="empty__icon" aria-hidden="true">🗺️</span>
              <p>出発地点と終着地点を入力して検索すると、ここにルートと地図が表示されます。</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
