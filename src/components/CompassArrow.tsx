import { useEffect, useRef, useState } from 'react';
import { normalizeAngle, shortestAngleDelta } from '../lib/geo';

type CompassArrowProps = {
  /** Rotation in degrees to point the needle at the destination. */
  rotation: number;
  /** Subtle label under the ring, e.g. arrival state changes the visuals. */
  arrived?: boolean;
};

const TICKS = Array.from({ length: 60 }, (_, i) => i * 6);
const CARDINALS = [
  { label: 'N', angle: 0 },
  { label: 'E', angle: 90 },
  { label: 'S', angle: 180 },
  { label: 'W', angle: 270 },
];

export function CompassArrow({ rotation, arrived = false }: CompassArrowProps) {
  // Track a continuous (unwrapped) rotation so the needle always swings
  // the *short* way, even across the 359deg -> 0deg seam (a plain
  // numeric jump from 359 to 1 would otherwise spin almost a full
  // circle the wrong way).
  //
  // The bouncy CSS transition is only enabled for *big* jumps - i.e.
  // switching to a different store via "Next nearest", which gives it
  // a satisfying dramatic swing. Small per-frame deltas from ordinary
  // device-heading tracking (already smoothed upstream, ~60/sec) are
  // applied with no transition, so physically turning the phone stays
  // instantly responsive instead of chasing a 300ms-lagged animation.
  const BIG_JUMP_THRESHOLD_DEGREES = 20;

  const [displayRotation, setDisplayRotation] = useState(rotation);
  const [swinging, setSwinging] = useState(false);
  const continuousRef = useRef(rotation);

  useEffect(() => {
    const delta = shortestAngleDelta(normalizeAngle(continuousRef.current), rotation);
    const next = continuousRef.current + delta;
    continuousRef.current = next;
    setSwinging(Math.abs(delta) > BIG_JUMP_THRESHOLD_DEGREES);
    setDisplayRotation(next);
  }, [rotation]);

  return (
    <div className={`compass-instrument${arrived ? ' compass-instrument--arrived' : ''}`}>
      <svg
        viewBox="0 0 300 300"
        className="compass-svg"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="faceGradient" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor="#171b21" />
            <stop offset="100%" stopColor="#0a0c0f" />
          </radialGradient>
          <linearGradient id="needleTip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brass-bright)" />
            <stop offset="100%" stopColor="var(--color-brass)" />
          </linearGradient>
        </defs>

        {/* face */}
        <circle cx="150" cy="150" r="142" fill="url(#faceGradient)" stroke="var(--color-ring)" strokeWidth="1.5" />

        {/* tick marks */}
        {TICKS.map((angle) => {
          const isMajor = angle % 90 === 0;
          const isMedium = angle % 30 === 0;
          const length = isMajor ? 18 : isMedium ? 12 : 6;
          const r1 = 142;
          const r2 = r1 - length;
          const rad = (angle * Math.PI) / 180;
          const x1 = 150 + r1 * Math.sin(rad);
          const y1 = 150 - r1 * Math.cos(rad);
          const x2 = 150 + r2 * Math.sin(rad);
          const y2 = 150 - r2 * Math.cos(rad);
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isMajor ? 'var(--color-ring-bright)' : 'var(--color-ring)'}
              strokeWidth={isMajor ? 2 : 1}
            />
          );
        })}

        {/* cardinal labels */}
        {CARDINALS.map(({ label, angle }) => {
          const r = 115;
          const rad = (angle * Math.PI) / 180;
          const x = 150 + r * Math.sin(rad);
          const y = 150 - r * Math.cos(rad);
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="compass-cardinal"
              fill={label === 'N' ? 'var(--color-brass)' : 'var(--color-ink-dim)'}
            >
              {label}
            </text>
          );
        })}

        {/* needle group, rotated to point at the destination */}
        <g
          style={{
            transform: `rotate(${displayRotation}deg)`,
            transformOrigin: '150px 150px',
            transition: swinging ? 'transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
          }}
        >
          {/* forward (destination) blade */}
          <polygon points="150,38 162,150 150,132 138,150" fill="url(#needleTip)" />
          {/* rear counterweight blade */}
          <polygon points="150,262 160,168 150,180 140,168" fill="var(--color-ring-bright)" />
        </g>

        {/* center hub */}
        <circle cx="150" cy="150" r="9" fill="var(--color-bg-raised)" stroke="var(--color-brass)" strokeWidth="2" />
      </svg>
    </div>
  );
}
