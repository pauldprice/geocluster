import { useMemo, useState } from 'react';
import { controller } from '../map/controller';
import { useAppState } from '../store';

/** Remembers column picks across opens for the session. */
let lastChosenCols: Set<string> | null = null;

export function DownloadModal(props: { onClose: () => void }) {
  const s = useAppState();
  const columns = useMemo(() => controller.downloadableColumns(), []);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(lastChosenCols ?? controller.defaultDownloadColumns())
  );

  const parts: string[] = [];
  if (s.lassoSelectionCount) parts.push(`lasso: ${s.lassoSelectionCount}`);
  if (s.selectedZones.length) parts.push(`${s.selectedZones.length} zone${s.selectedZones.length === 1 ? '' : 's'}`);

  const toggle = (c: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div id="dlOverlay" onClick={e => e.target === e.currentTarget && props.onClose()}>
      <div className="dl-box">
        <strong>Download selected households</strong>
        <div className="hint">
          {s.selectionCount} household{s.selectionCount === 1 ? '' : 's'} selected ({parts.join(' + ')})
        </div>
        <div className="hint">Choose columns to include:</div>
        <div id="dlCols">
          {columns.map(c => (
            <label key={c}>
              <input type="checkbox" checked={checked.has(c)} onChange={() => toggle(c)} />
              {c}
            </label>
          ))}
        </div>
        <div className="dl-actions">
          <button className="secondary" onClick={props.onClose}>
            Cancel
          </button>
          <button
            onClick={() => {
              if (!checked.size) return;
              lastChosenCols = new Set(checked);
              controller.downloadSelected(columns.filter(c => checked.has(c)));
              props.onClose();
            }}
          >
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}
