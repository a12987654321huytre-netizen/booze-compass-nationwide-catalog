import { useMemo } from 'react';
import { calculateArrowRotation } from '../lib/geo';

/**
 * Returns the rotation (0-360) to apply to the arrow graphic, or null if
 * we don't have a device heading and should fall back to a text-only
 * direction instead of a spinning arrow.
 */
export function useCompassBearing(
  destinationBearing: number | undefined,
  deviceHeading: number | null
): number | null {
  return useMemo(() => {
    if (destinationBearing === undefined || deviceHeading === null) return null;
    return calculateArrowRotation(destinationBearing, deviceHeading);
  }, [destinationBearing, deviceHeading]);
}
