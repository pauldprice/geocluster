import { controller } from '../map/controller';
import { useAppState } from '../store';

export function AlertBanner() {
  const s = useAppState();
  if (!s.alerts.length) return null;
  return (
    <div id="alertBanner">
      {'🚨 '}
      {s.alerts.map(a => {
        const households = controller.householdCountInZone(a.zone);
        return (
          <span key={a.zone} className="zone-alert" onClick={() => controller.selectZoneAndZoom(a.zone)}>
            {a.zone}
            {a.name ? ` (${a.name})` : ''}: {a.status}
            {households ? ` · ${households} households` : ''}
          </span>
        );
      })}
    </div>
  );
}
