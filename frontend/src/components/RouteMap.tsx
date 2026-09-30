import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Stop } from '../api';

// 番号入りの丸いマーカー（S=出発, 数字=経由地, G=終着）
function stopIcon(label: string, kind: 'start' | 'waypoint' | 'end') {
  return L.divIcon({
    className: '',
    html: `<span class="map-marker map-marker--${kind}">${label}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function RouteMap({ stops }: { stops: Stop[] }) {
  const positions = stops.map((s) => [s.lat, s.lng] as [number, number]);

  return (
    // key を変えると、検索し直したときに地図が作り直されて新しい範囲に合わせてくれる
    <MapContainer key={JSON.stringify(positions)} bounds={L.latLngBounds(positions).pad(0.15)} className="map" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* 点線 = 直線距離であることを表す（実際の道順ではない） */}
      <Polyline positions={positions} pathOptions={{ color: '#0f766e', weight: 3, dashArray: '6 8' }} />
      {stops.map((stop, i) => {
        const isStart = i === 0;
        const isEnd = i === stops.length - 1;
        const label = isStart ? 'S' : isEnd ? 'G' : String(i);
        const kind = isStart ? 'start' : isEnd ? 'end' : 'waypoint';
        return (
          <Marker key={i} position={[stop.lat, stop.lng]} icon={stopIcon(label, kind)}>
            <Tooltip>{stop.displayName}</Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
