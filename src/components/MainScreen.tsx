import type { LiquorStore } from '../types/store';
import type { StoreStatus } from '../types/store';
import { CompassArrow } from './CompassArrow';
import { StatusBadge } from './StatusBadge';
import { BottomActions } from './BottomActions';
import { CachedBanner, LowAccuracyBanner, FilterToggle, WidenNetBanner } from './StateScreens';
import { formatDistance, bearingToCompassPoint } from '../lib/geo';
import { distanceQuip } from '../lib/copy';
import type { FilterPreference } from '../hooks/useFilterPreference';

type MainScreenProps = {
  store: LiquorStore;
  status: StoreStatus;
  rotation: number | null;
  usingCache: boolean;
  lowAccuracy: boolean;
  filterPreference: FilterPreference;
  onFilterChange: (pref: FilterPreference) => void;
  filterDisabled: boolean;
  onDirections: () => void;
  onNextNearest: () => void;
  hasNext: boolean;
  currentRadiusMeters: number;
  isWidening: boolean;
  canWidenFurther: boolean;
  onWidenSearch: () => void;
};

export function MainScreen({
  store,
  status,
  rotation,
  usingCache,
  lowAccuracy,
  filterPreference,
  onFilterChange,
  filterDisabled,
  onDirections,
  onNextNearest,
  hasNext,
  currentRadiusMeters,
  isWidening,
  canWidenFurther,
  onWidenSearch,
}: MainScreenProps) {
  const distanceMeters = store.distanceMeters ?? 0;
  const quip = distanceQuip(distanceMeters);

  return (
    <div className="screen main-screen">
      <div className="main-screen__top">
        <p className="logo">BOOZE COMPASS</p>
        <FilterToggle
          preference={filterPreference}
          onChange={onFilterChange}
          disabled={filterDisabled}
        />
      </div>

      {usingCache && <CachedBanner />}
      {lowAccuracy && <LowAccuracyBanner />}

      <div className="main-screen__compass">
        {rotation !== null ? (
          <CompassArrow rotation={rotation} />
        ) : (
          <div className="compass-fallback">
            <p className="compass-fallback__label">Ag no compass, just vibes</p>
            <p className="compass-fallback__direction">
              {store.bearingDegrees !== undefined
                ? bearingToCompassPoint(store.bearingDegrees)
                : ''}
            </p>
          </div>
        )}
      </div>

      <p className="distance" aria-live="polite">
        {formatDistance(distanceMeters)}
        {store.bearingDegrees !== undefined && (
          <span className="visually-hidden">
            {' '}
            {bearingToCompassPoint(store.bearingDegrees)}
          </span>
        )}
      </p>

      <p className="store-name">{store.name}</p>
      {store.address && <p className="store-address">{store.address}</p>}
      <StatusBadge status={status} />
      {quip && <p className="quip">{quip}</p>}

      <WidenNetBanner
        currentRadiusMeters={currentRadiusMeters}
        isWidening={isWidening}
        canWidenFurther={canWidenFurther}
        onWiden={onWidenSearch}
      />

      <BottomActions
        onDirections={onDirections}
        onNextNearest={onNextNearest}
        hasNext={hasNext}
      />
    </div>
  );
}
