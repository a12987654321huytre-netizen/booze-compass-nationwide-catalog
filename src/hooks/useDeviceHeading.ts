import { useCallback, useEffect, useRef, useState } from 'react';
import { smoothAngle } from '../lib/geo';
import { CONFIG } from '../lib/config';

export type HeadingPermissionState =
  | 'unknown' // haven't asked yet
  | 'not-required' // browser doesn't gate this behind a permission (most non-iOS)
  | 'granted'
  | 'denied'
  | 'unavailable'; // no orientation sensor / API at all (e.g. most desktops)

type UseDeviceHeadingResult = {
  /** Smoothed heading in degrees, 0-360, or null until we get a first reading. */
  heading: number | null;
  permission: HeadingPermissionState;
  /** Call from a user-gesture (button tap) - required on iOS 13+. */
  requestPermission: () => Promise<void>;
};

// Some browsers (notably older iOS Safari) expose a non-standard
// `requestPermission` static method on DeviceOrientationEvent.
type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

// Safari also exposes a ready-to-use compass heading directly on the
// event, which is more reliable than reconstructing it from alpha.
type WebkitOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

export function useDeviceHeading(devOverride?: number | null): UseDeviceHeadingResult {
  const [rawHeading, setRawHeading] = useState<number | null>(null);
  const [smoothedHeading, setSmoothedHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<HeadingPermissionState>('unknown');
  const targetRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const webkitEvent = event as WebkitOrientationEvent;
    let heading: number | null = null;

    if (typeof webkitEvent.webkitCompassHeading === 'number') {
      // iOS: already a true compass heading, clockwise from north.
      heading = webkitEvent.webkitCompassHeading;
    } else if (event.absolute && event.alpha !== null) {
      // Most Android browsers: alpha increases counter-clockwise from
      // north when the device lies flat, so invert it.
      heading = (360 - event.alpha) % 360;
    } else if (event.alpha !== null) {
      // Non-absolute fallback - better than nothing, may drift.
      heading = (360 - event.alpha) % 360;
    }

    if (heading !== null && !Number.isNaN(heading)) {
      targetRef.current = heading;
      setRawHeading(heading);
    }
  }, []);

  const attachListener = useCallback(() => {
    const absoluteSupported = 'ondeviceorientationabsolute' in window;
    if (absoluteSupported) {
      window.addEventListener(
        'deviceorientationabsolute',
        handleOrientation as EventListener
      );
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      if (absoluteSupported) {
        window.removeEventListener(
          'deviceorientationabsolute',
          handleOrientation as EventListener
        );
      } else {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, [handleOrientation]);

  const requestPermission = useCallback(async () => {
    const DOE = DeviceOrientationEvent as DeviceOrientationEventWithPermission;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        setPermission(result === 'granted' ? 'granted' : 'denied');
        return;
      } catch {
        setPermission('denied');
        return;
      }
    }
    // Browser doesn't gate this behind an explicit permission prompt.
    setPermission('not-required');
  }, []);

  // Detect baseline availability on mount.
  useEffect(() => {
    if (devOverride !== undefined) return;
    if (typeof DeviceOrientationEvent === 'undefined') {
      setPermission('unavailable');
      return;
    }
    const DOE = DeviceOrientationEvent as DeviceOrientationEventWithPermission;
    if (typeof DOE.requestPermission !== 'function') {
      setPermission('not-required');
    }
  }, [devOverride]);

  useEffect(() => {
    if (devOverride !== undefined) return;
    if (permission !== 'granted' && permission !== 'not-required') return;
    return attachListener();
  }, [permission, attachListener, devOverride]);

  // Smooth the raw heading toward its target every animation frame so the
  // arrow doesn't jitter with every noisy sensor reading.
  useEffect(() => {
    if (devOverride !== undefined) return;

    const tick = () => {
      setSmoothedHeading((prev) => {
        if (targetRef.current === null) return prev;
        if (prev === null) return targetRef.current;
        return smoothAngle(prev, targetRef.current, CONFIG.headingSmoothingAlpha);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [devOverride]);

  if (devOverride !== undefined) {
    return {
      heading: devOverride,
      permission: devOverride === null ? 'unavailable' : 'granted',
      requestPermission: async () => {},
    };
  }

  return { heading: smoothedHeading ?? rawHeading, permission, requestPermission };
}
