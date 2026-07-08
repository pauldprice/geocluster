import { controller } from '../map/controller';
import { useAppState } from '../store';

export function ZonePanel() {
  const s = useAppState();
  if (s.selectedZones.length === 0) return null;

  const nz = s.selectedZones.length;
  const nh = s.panelRows.length;
  const countByZone = new Map<string, number>();
  s.panelRows.forEach(r => countByZone.set(r.zone, (countByZone.get(r.zone) || 0) + 1));

  return (
    <div id="zonePanel" style={{ top: 'calc(140px + 12px)' }}>
      <div className="panel-head">
        <strong>
          {nz} zone{nz === 1 ? '' : 's'} selected · {nh} household{nh === 1 ? '' : 's'}
        </strong>
        <button className="secondary" title="Clear zone selection" onClick={() => controller.clearZoneSelection()}>
          ✕
        </button>
      </div>
      <div id="zoneChips">
        {s.selectedZones.map(zone => (
          <span
            key={zone}
            className="chip"
            title="Click to deselect"
            onClick={() => controller.toggleZoneSelection(zone)}
          >
            <span className="dot" style={{ background: s.zoneChipColors[zone] }} />
            {zone} ({countByZone.get(zone) || 0}) ✕
          </span>
        ))}
      </div>
      <div id="zoneTableWrap">
        {s.rowCount === 0 ? (
          <div className="hint" style={{ padding: 12 }}>No household CSV loaded yet.</div>
        ) : s.panelRows.length === 0 ? (
          <div className="hint" style={{ padding: 12 }}>No households in the selected zones.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Zone</th>
                {s.panelColumns.map(c => (
                  <th key={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</th>
                ))}
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {s.panelRows.map(r => (
                <tr key={r.idx} onClick={() => controller.panToHousehold(r.idx)}>
                  <td>{r.zone}</td>
                  {r.cells.map((c, i) => (
                    <td key={i}>{String(c)}</td>
                  ))}
                  <td>{r.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
