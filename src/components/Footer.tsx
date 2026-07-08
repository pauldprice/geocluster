import { useAppState } from '../store';

export function Footer() {
  const s = useAppState();
  const bits: string[] = [];
  if (s.statusPoll) {
    const t = s.statusPoll.time.toLocaleTimeString();
    bits.push(
      `Zone status: ${s.statusPoll.checked} point${s.statusPoll.checked === 1 ? '' : 's'} checked at ${t}` +
        (s.statusPoll.errors ? ` (${s.statusPoll.errors} errors)` : '') +
        ` · ${s.alerts.length} zones alerted · Boise County live via county ArcGIS (Ready/Set/Go), Ada County live via Genasys`
    );
  }
  if (s.lastFireUpdate) {
    let fire = `Fires: ${s.fireCount} active in Idaho (NIFC, updated ${s.lastFireUpdate.toLocaleTimeString()})`;
    if (s.satStats) {
      fire += ` · ${s.satStats.count} satellite detections ≤96h`;
      if (s.satStats.count) {
        fire += `, ${s.satStats.clusters} active cluster${s.satStats.clusters === 1 ? '' : 's'}, newest ${s.satStats.newestHours}h ago (NASA FIRMS)`;
      } else {
        fire += ' (NASA FIRMS)';
      }
    }
    if (s.goesStats?.count) fire += ` · ${s.goesStats.count} GOES ≤6h, newest ${s.goesStats.newestMin}min (NOAA HMS)`;
    bits.push(fire);
  }

  return (
    <footer>
      <div className="legend">
        {s.legend.map(e => (
          <div key={e.label} className="chip">
            <span className="dot" style={{ background: e.color }} />
            {e.label}
          </div>
        ))}
        {s.warnings.suspect > 0 && (
          <div className="chip" style={{ background: '#fee2e2' }}>
            ⚠️ suspect geocode: {s.warnings.suspect} (duplicate coords)
          </div>
        )}
        {s.warnings.noZone > 0 && (
          <div className="chip" style={{ background: '#ffedd5' }}>
            🟠 no evac zone: {s.warnings.noZone}
          </div>
        )}
        {s.warnings.noCoord > 0 && (
          <div className="chip" style={{ background: '#f3f4f6' }}>
            ✖ no coordinates: {s.warnings.noCoord} (not on map)
          </div>
        )}
      </div>
      <div className="hint" style={{ marginTop: 6 }}>{bits.join(' · ')}</div>
      <div className="hint" style={{ marginTop: 6 }}>
        Tip: CSV headers can be <code>lat/lon</code>, <code>latitude/longitude</code>, or <code>lat/lng</code>.
        Other columns (e.g., address, family) are preserved in export.
      </div>
    </footer>
  );
}
