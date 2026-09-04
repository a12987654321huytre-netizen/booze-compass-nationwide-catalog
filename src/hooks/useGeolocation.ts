import { useCallback, useEffect, useRef, useState } from 'react';

export type GeoPosition = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

export type GeoPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

type UseGeolocationResult = {
  position: GeoPosition | null;
  permission: GeoPermissionState;
  error: string | null;
  requestPermission: () => void;
};

/**
 * Dev-only override so the app is testable on a desktop with no real GPS.
 * Only ever read when import.meta.env.DEV is true (see useDevOverrides).
 */
export function useGeolocation(devOverride?: GeoPosition | null): UseGeolocationResult {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [permission, setPermission] = useState<GeoPermissionState>('prompt');
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setPermission('unsupported');
      return;
    }
    clearWatch();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPermission('granted');
        setError(null);
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied');
        } else {
          setError('Could not get your location. Check your GPS signal and try again.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }, [clearWatch]);

  const requestPermission = useCallback(() => {
    startWatch();
  }, [startWatch]);

  // Pause the GPS watch while the tab/app is hidden to save battery, and
  // restart cleanly when it comes back to the foreground.
  useEffect(() => {
    if (devOverride !== undefined) return; // dev override takes over entirely

    const handleVisibility = () => {
      if (document.hidden) {
        clearWatch();
      } else if (permission === 'granted') {
        startWatch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [clearWatch, startWatch, permission, devOverride]);

  useEffect(() => clearWatch, [clearWatch]);

  if (devOverride !== undefined && devOverride !== null) {
    return {
      position: devOverride,
      permission: 'granted',
      error: null,
      requestPermission: () => {},
    };
  }

  return { position, permission, error, requestPermission };
}
