/**
 * Geographic math utilities.
 *
 * Everything here is pure and deterministic so it can be unit tested with
 * known coordinate pairs. Nothing in this file touches the DOM, sensors,
 * or network.
 */

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/**
 * Great-circle distance between two coordinates using the Haversine formula.
 * Accurate for the short-to-medium distances this app cares about (a few
 * hundred metres to tens of kilometres) and cheap enough to run on every
 * GPS update.
 */
export function getDistanceMeters(
  userLat: number,
  userLon: number,
  storeLat: number,
  storeLon: number
): number {
  const dLat = toRadians(storeLat - userLat);
  const dLon = toRadians(storeLon - userLon);

  const lat1 = toRadians(userLat);
  const lat2 = toRadians(storeLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Initial compass bearing (0-360, true north) from the user to a
 * destination. This is the bearing to steer at the start of the great
 * circle path, which is what a hand-held compass app needs.
 */
export function calculateBearing(
  userLatitude: number,
  userLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number
): number {
  const lat1 = toRadians(userLatitude);
  const lat2 = toRadians(destinationLatitude);
  const dLon = toRadians(destinationLongitude - userLongitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearing = toDegrees(Math.atan2(y, x));
  return normalizeAngle(bearing);
}

/** Wrap any angle into the [0, 360) range. */
export function normalizeAngle(angle: number): number {
  const wrapped = angle % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Shortest signed difference between two angles, in the range (-180, 180].
 * Positive means "turn clockwise from `from` to `to`".
 */
export function shortestAngleDelta(from: number, to: number): number {
  const diff = normalizeAngle(to - from);
  return diff > 180 ? diff - 360 : diff;
}

/**
 * Interpolate from one angle toward another along the shortest arc,
 * moving at most `maxStep` degrees. Used to smooth raw compass jitter
 * without ever spinning the long way round (e.g. 359 degrees to 1 degree
 * should step forward through 360/0, not backward through 180).
 */
export function stepTowardsAngle(
  current: number,
  target: number,
  maxStep: number
): number {
  const delta = shortestAngleDelta(current, target);
  const clamped = Math.max(-maxStep, Math.min(maxStep, delta));
  return normalizeAngle(current + clamped);
}

/**
 * Exponential smoothing toward a target angle, taking the shortest path.
 * `alpha` in (0, 1]: higher = snappier, lower = smoother/laggier.
 */
export function smoothAngle(
  current: number,
  target: number,
  alpha: number
): number {
  const delta = shortestAngleDelta(current, target);
  return normalizeAngle(current + delta * alpha);
}

/** Compass rotation to apply to an arrow so it points at the destination. */
export function calculateArrowRotation(
  destinationBearing: number,
  deviceHeading: number
): number {
  return normalizeAngle(destinationBearing - deviceHeading);
}

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
];

/** Human 16-point compass label for a bearing, e.g. "northwest". */
export function bearingToCompassPoint(bearing: number): string {
  const index = Math.round(normalizeAngle(bearing) / 22.5) % 16;
  const abbr = COMPASS_POINTS[index];
  const full: Record<string, string> = {
    N: 'north', NNE: 'north-northeast', NE: 'northeast', ENE: 'east-northeast',
    E: 'east', ESE: 'east-southeast', SE: 'southeast', SSE: 'south-southeast',
    S: 'south', SSW: 'south-southwest', SW: 'southwest', WSW: 'west-southwest',
    W: 'west', WNW: 'west-northwest', NW: 'northwest', NNW: 'north-northwest',
  };
  return full[abbr];
}

/** Human-readable distance, e.g. "620 m", "2.4 km". Never raw floats. */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    // Round to the nearest 10m under 1km so the number doesn't jitter
    // wildly with every GPS fix.
    const rounded = Math.round(meters / 10) * 10;
    return `${rounded} m`;
  }
  const km = meters / 1000;
  const decimals = km < 10 ? 1 : 0;
  return `${km.toFixed(decimals)} km`;
}
