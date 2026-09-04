import { useState } from 'react';
import type { GeoPosition } from '../hooks/useGeolocation';

type DevPanelProps = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  position: GeoPosition;
  onPositionChange: (position: GeoPosition) => void;
  heading: number;
  onHeadingChange: (heading: number) => void;
};

/**
 * Only ever imported/mounted behind `import.meta.env.DEV` (see App.tsx).
 * Lets a developer simulate GPS + compass values that desktop dev
 * environments can't produce for real.
 */
export function DevPanel({
  enabled,
  onToggle,
  position,
  onPositionChange,
  heading,
  onHeadingChange,
}: DevPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="dev-panel">
      <button className="dev-panel__toggle" onClick={() => setOpen((o) => !o)}>
        DEV {enabled ? '● SIM' : '○'}
      </button>
      {open && (
        <div className="dev-panel__body">
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
            />
            Use simulated location
          </label>
          <label>
            Lat
            <input
              type="number"
              step="0.0001"
              value={position.latitude}
              onChange={(e) =>
                onPositionChange({ ...position, latitude: parseFloat(e.target.value) })
              }
            />
          </label>
          <label>
            Lon
            <input
              type="number"
              step="0.0001"
              value={position.longitude}
              onChange={(e) =>
                onPositionChange({ ...position, longitude: parseFloat(e.target.value) })
              }
            />
          </label>
          <label>
            Heading
            <input
              type="range"
              min={0}
              max={359}
              value={heading}
              onChange={(e) => onHeadingChange(parseFloat(e.target.value))}
            />
            <span>{Math.round(heading)}°</span>
          </label>
        </div>
      )}
    </div>
  );
}
