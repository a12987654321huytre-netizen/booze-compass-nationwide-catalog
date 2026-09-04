import { useEffect, useMemo, useState } from 'react';
import './App.css';

import { useGeolocation } from './hooks/useGeolocation';
import { useDeviceHeading } from './hooks/useDeviceHeading';
import { useNearbyLiquorStores } from './hooks/useNearbyLiquorStores';
import { useCompassBearing } from './hooks/useCompassBearing';
import { useFilterPreference } from './hooks/useFilterPreference';
import { useDevSimulation } from './hooks/useDevSimulation';
import { useStoreStatuses } from './hooks/useStoreStatuses';

import { StartScreen, LocationDeniedScreen } from './components/StartScreen';
import { EnableCompassPrompt } from './components/EnableCompassPrompt';
import { MainScreen } from './components/MainScreen';
import {
  LoadingScreen,
  NoStoresFound,
  ErrorScreen,
  ArrivedScreen,
} from './components/StateScreens';
import { DevPanel } from './components/DevPanel';

import { openDirections } from './lib/directions';
import { CONFIG } from './lib/config';

type AppStage = 'intro' | 'awaiting-compass' | 'location-denied' | 'active';

// iOS 13+ gates DeviceOrientationEvent behind an explicit user gesture.
function needsExplicitCompassPermission(): boolean {
  type MaybeGated = typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as MaybeGated).requestPermission === 'function'
  );
}

export default function App() {
  const [stage, setStage] = useState<AppStage>('intro');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const dev = useDevSimulation();
  const isDev = import.meta.env.DEV;

  const geo = useGeolocation(isDev && dev.enabled ? dev.position : undefined);
  const headingResult = useDeviceHeading(isDev && dev.enabled ? dev.heading : undefined);

  const {
    stores,
    state,
    usingCache,
    errorMessage,
    refresh,
    widenSearch,
    canWidenFurther,
    currentRadiusMeters,
  } = useNearbyLiquorStores(geo.position);

  const { preference, setPreference } = useFilterPreference();

  // Attach a status (open/closed/unknown) to every candidate store. The
  // opening_hours parser loads lazily, so statuses fill in a moment after
  // the stores themselves appear.
  const statusMap = useStoreStatuses(stores);
  const storesWithStatus = useMemo(
    () => stores.map((store) => ({ store, status: statusMap.get(store.id) ?? { state: 'unknown' as const } })),
    [stores, statusMap]
  );

  const hasAnyOpeningHours = useMemo(
    () => stores.some((s) => Boolean(s.openingHours)),
    [stores]
  );

  const visibleStores = useMemo(() => {
    if (preference === 'nearest-open') {
      // Unknown never counts as closed - only exclude confidently-closed stores.
      return storesWithStatus.filter((s) => s.status.state !== 'closed');
    }
    return storesWithStatus;
  }, [storesWithStatus, preference]);

  // Keep the selection in range whenever the visible list changes.
  useEffect(() => {
    setSelectedIndex(0);
  }, [visibleStores.length, preference]);

  const selected = visibleStores[selectedIndex] ?? null;

  const rotation = useCompassBearing(
    selected?.store.bearingDegrees,
    headingResult.permission === 'unavailable' ? null : headingResult.heading
  );

  const arrived =
    selected !== null &&
    (selected.store.distanceMeters ?? Infinity) <= CONFIG.arrivalRadiusMeters;

  // --- permission flow -------------------------------------------------

  const handleStart = () => {
    geo.requestPermission();
  };

  useEffect(() => {
    if (stage !== 'intro') return;
    if (geo.permission === 'denied') {
      setStage('location-denied');
    } else if (geo.permission === 'granted') {
      setStage(needsExplicitCompassPermission() ? 'awaiting-compass' : 'active');
    }
  }, [geo.permission, stage]);

  const handleEnableCompass = async () => {
    await headingResult.requestPermission();
    setStage('active');
  };

  const handleSkipCompass = () => setStage('active');

  const handleDirections = () => {
    if (!selected) return;
    openDirections(selected.store.latitude, selected.store.longitude, selected.store.name);
  };

  const handleNextNearest = () => {
    if (visibleStores.length === 0) return;
    setSelectedIndex((i) => (i + 1) % visibleStores.length);
  };

  const lowAccuracy = (geo.position?.accuracyMeters ?? 0) > 100;

  let content: React.ReactNode;

  if (stage === 'intro') {
    content = <StartScreen onStart={handleStart} errorMessage={geo.error} />;
  } else if (stage === 'location-denied') {
    content = <LocationDeniedScreen onRetry={handleStart} />;
  } else if (stage === 'awaiting-compass') {
    content = <EnableCompassPrompt onEnable={handleEnableCompass} onSkip={handleSkipCompass} />;
  } else if (!geo.position || state === 'loading' || (state === 'widening' && !selected)) {
    content = (
      <LoadingScreen
        label={state === 'widening' ? `Casting wider — ${(currentRadiusMeters / 1000).toFixed(0)} km… just now` : 'Sniffing out your nearest dop…'}
      />
    );
  } else if (state === 'error') {
    content = <ErrorScreen message={errorMessage ?? 'Something went wrong.'} onRetry={refresh} />;
  } else if (state === 'empty' || !selected) {
    content = <NoStoresFound onSearchFarther={widenSearch} canSearchFarther={canWidenFurther} />;
  } else if (arrived) {
    content = (
      <ArrivedScreen
        storeName={selected.store.name}
        address={selected.store.address}
        onDirections={handleDirections}
        onNextNearest={handleNextNearest}
      />
    );
  } else {
    content = (
      <MainScreen
        store={selected.store}
        status={selected.status}
        rotation={rotation}
        usingCache={usingCache}
        lowAccuracy={lowAccuracy}
        filterPreference={preference}
        onFilterChange={setPreference}
        filterDisabled={!hasAnyOpeningHours}
        onDirections={handleDirections}
        onNextNearest={handleNextNearest}
        hasNext={visibleStores.length > 1}
        currentRadiusMeters={currentRadiusMeters}
        isWidening={state === 'widening'}
        canWidenFurther={canWidenFurther}
        onWidenSearch={widenSearch}
      />
    );
  }

  return (
    <>
      {content}
      {isDev && (
        <DevPanel
          enabled={dev.enabled}
          onToggle={dev.setEnabled}
          position={dev.position}
          onPositionChange={dev.setPosition}
          heading={dev.heading}
          onHeadingChange={dev.setHeading}
        />
      )}
    </>
  );
}
