import { useRef, useState } from 'react';
import { controller } from '../map/controller';
import { useAppState } from '../store';

export function Toolbar(props: { onOpenDownload: () => void }) {
  const s = useAppState();
  const [label, setLabel] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const hasData = s.rowCount > 0;

  return (
    <div className="toolbar">
      <label className="pill">
        <strong>1)</strong> Load CSV:
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void controller.loadCsv(file);
          }}
        />
      </label>
      <span className="pill">
        <strong>2)</strong> Lasso:
        <button className="secondary" disabled={!hasData} onClick={() => controller.toggleLasso()}>
          {s.lassoEnabled ? 'Disable' : 'Enable'}
        </button>
        <button
          className="secondary"
          disabled={s.lassoSelectionCount === 0}
          onClick={() => controller.clearSelection()}
        >
          Clear Selection
        </button>
      </span>
      <span className="pill">
        <strong>3)</strong> Label selected:
        <input
          type="text"
          placeholder="e.g., Foothills East"
          disabled={!hasData}
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
        <button disabled={!hasData} onClick={() => controller.applyLabel(label)}>
          Apply
        </button>
      </span>
      <span className="pill">
        <strong>4)</strong> Export:
        <button disabled={!hasData} onClick={() => controller.exportAll()}>
          Download CSV (+label)
        </button>
        <button className="secondary" disabled={s.selectionCount === 0} onClick={props.onOpenDownload}>
          Download selected…
        </button>
      </span>
      <span className="pill">
        Evac zones:
        <button className="secondary" disabled={!s.zonesReady} onClick={() => controller.toggleZonesVisible()}>
          {s.showZones ? 'Hide' : 'Show'}
        </button>
      </span>
      <span className="pill">
        Fires:
        <button className="secondary" onClick={() => controller.toggleFiresVisible()}>
          {s.showFires ? 'Hide' : 'Show'}
        </button>
      </span>
      <span className="pill">
        GOES:
        <button className="secondary" onClick={() => controller.toggleGoesVisible()}>
          {s.showGoes ? 'Hide' : 'Show'}
        </button>
      </span>
      <span className="hint">{s.status}</span>
    </div>
  );
}
