import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';

/**
 * Locality-level map. MKs are grouped by home locality (or birthplace), never placed below locality level.
 * mode: 'residence' | 'birthplace'
 */
export default function MKMap({ mks, partyById, height = 520, mode = 'residence', localities }) {
  const groups = useMemo(() => {
    const g = {};
    for (const m of mks) {
      const place = mode === 'birthplace' ? m.birthplace_loc : m.residence;
      if (!place?.lat) continue;
      const key = `${place.lat},${place.lon}`;
      if (!g[key]) g[key] = { lat: place.lat, lon: place.lon, name: place.name, code: place.code, items: [] };
      g[key].items.push(m);
    }
    return Object.values(g).sort((a, b) => b.items.length - a.items.length);
  }, [mks, mode]);

  return (
    <div className="rounded-xl overflow-hidden border border-rule" style={{ height }}>
      <MapContainer center={[31.75, 34.95]} zoom={8} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" subdomains="abcd" />
        {groups.map((g) => {
          const parties = {};
          g.items.forEach((m) => (parties[m.party] = (parties[m.party] || 0) + 1));
          const top = Object.entries(parties).sort((a, b) => b[1] - a[1])[0][0];
          const loc = localities?.[g.code];
          return (
            <CircleMarker key={`${g.lat},${g.lon}`} center={[g.lat, g.lon]} radius={5 + Math.sqrt(g.items.length) * 4}
              pathOptions={{ color: '#182033', weight: 1, fillColor: partyById[top]?.color, fillOpacity: 0.85 }}>
              <Popup>
                <div className="grid gap-1 min-w-[180px]">
                  <div className="font-bold">{g.name} <span className="font-normal text-xs">({g.items.length})</span></div>
                  {loc && (
                    <div className="text-[11px] text-gray-600">
                      אוכלוסייה: {loc.population?.toLocaleString('he-IL') ?? '—'}
                      {loc.socioeconomic_cluster != null && <> · אשכול חב׳-כלכלי: {loc.socioeconomic_cluster}</>}
                    </div>
                  )}
                  <ul className="grid gap-0.5 text-sm">
                    {g.items.map((m) => (
                      <li key={m.id} className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: partyById[m.party]?.color }} />
                        <Link to={`/mk/${m.id}`}>{m.name_he}</Link>
                        <span className="text-[11px] text-gray-500">{partyById[m.party]?.name_he}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
