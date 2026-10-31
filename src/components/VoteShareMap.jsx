import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip } from 'react-leaflet';
import { useData } from '@/lib/data';

/** Party vote share by locality: circle area ∝ party votes, opacity ∝ share of the locality's valid votes. */
export default function VoteShareMap({ partyId, color, height = 560, mks = [] }) {
  const { data: res } = useData('results_by_locality.json');
  const { data: locs } = useData('localities.json');
  const pts = useMemo(() => {
    if (!res || !locs) return [];
    const out = [];
    for (const [code, r] of Object.entries(res)) {
      const v = r[partyId];
      const L = locs[code];
      if (!v || !L?.lat) continue;
      out.push({ code, name: L.name, lat: L.lat, lon: L.lon, v, share: v / r.valid, valid: r.valid, ses: L.socioeconomic_cluster });
    }
    return out.sort((a, b) => b.v - a.v);
  }, [res, locs, partyId]);
  const maxV = pts[0]?.v || 1;
  const homes = mks.filter((m) => m.residence?.lat);

  return (
    <div className="grid gap-2 max-w-xl">
      <div className="rounded-xl overflow-hidden border border-rule" style={{ height }}>
        <MapContainer bounds={[[29.5, 34.25], [33.3, 35.85]]} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" referrerPolicy="strict-origin-when-cross-origin" />
          {pts.map((p) => (
            <CircleMarker key={p.code} center={[p.lat, p.lon]} radius={2 + 22 * Math.sqrt(p.v / maxV)}
              pathOptions={{ stroke: false, fillColor: color, fillOpacity: 0.15 + 0.75 * Math.min(1, p.share / 0.6) }}>
              <LTooltip direction="top">
                <div dir="rtl" className="text-xs">
                  <strong>{p.name}</strong><br />
                  {p.v.toLocaleString('he-IL')} קולות · {(p.share * 100).toFixed(1)}% מהקולות ביישוב
                  {p.ses != null && <><br />אשכול חברתי-כלכלי: {p.ses}</>}
                </div>
              </LTooltip>
            </CircleMarker>
          ))}
          {homes.map((m) => (
            <CircleMarker key={m.id} center={[m.residence.lat, m.residence.lon]} radius={4}
              pathOptions={{ color: '#182033', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
              <LTooltip direction="top"><span dir="rtl">{m.name_he} · {m.residence.name}</span></LTooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="text-[11px] text-sub">גודל העיגול = מספר הקולות למפלגה ביישוב; עוצמת הצבע = שיעור המפלגה מהקולות ביישוב. נקודות לבנות = יישובי המגורים של נבחרי המפלגה (ברמת יישוב).</p>
    </div>
  );
}
