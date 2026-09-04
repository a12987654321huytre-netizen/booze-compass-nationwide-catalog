import { useState } from 'react';
import type { GeoPosition } from './useGeolocation';

export type DevSimulationState = {
  enabled: boolean;
  position: GeoPosition | null;
  heading: number | null;
};

const DEFAULT_DEV_POSITION: GeoPosition = {
  // Stellenbosch, South Africa - arbitrary but real, matches the brief's
  // SA-first example copy.
  latitude: -33.9321,
  longitude: 18.8602,
  accuracyMeters: 8,
};

/**
 * Lets a developer punch in a fake lat/lon/heading so the app is testable
 * without real GPS/compass hardware. Never imported outside of DEV mode.
 */
export function useDevSimulation() {
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState<GeoPosition>(DEFAULT_DEV_POSITION);
  const [heading, setHeading] = useState<number>(270);

  return {
    enabled,
    setEnabled,
    position,
    setPosition,
    heading,
    setHeading,
  };
}
