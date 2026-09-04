type StartScreenProps = {
  onStart: () => void;
  errorMessage?: string | null;
};

export function StartScreen({ onStart, errorMessage }: StartScreenProps) {
  return (
    <div className="screen screen--center">
      <p className="eyebrow">Booze Compass</p>
      <h1 className="headline">FIND THE BOOZE.</h1>
      <p className="subcopy">
        Share your location and we'll point you in the right direction. We
        use it to find nearby bottle stores, not to follow you around.
      </p>
      <button className="btn btn--primary" onClick={onStart}>
        LEKKER, LET'S GO
      </button>
      {errorMessage && <p className="error-text">{errorMessage}</p>}
    </div>
  );
}

export function LocationDeniedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="screen screen--center">
      <p className="eyebrow">Booze Compass</p>
      <h1 className="headline headline--small">Eish, we're flying blind.</h1>
      <p className="subcopy">
        Can't sniff out a dop without knowing roughly which town you're in,
        boet. Flip location on for this site in your browser settings, then
        give it another go.
      </p>
      <button className="btn btn--secondary" onClick={onRetry}>
        Sharp, try again
      </button>
    </div>
  );
}
