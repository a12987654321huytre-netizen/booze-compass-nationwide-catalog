type BottomActionsProps = {
  onDirections: () => void;
  onNextNearest: () => void;
  hasNext: boolean;
};

export function BottomActions({ onDirections, onNextNearest, hasNext }: BottomActionsProps) {
  return (
    <div className="bottom-actions">
      <button className="action-btn" onClick={onDirections} aria-label="Get directions to this store">
        Take Me There
      </button>
      <div className="bottom-actions__divider" aria-hidden="true" />
      <button
        className="action-btn"
        onClick={onNextNearest}
        disabled={!hasNext}
        aria-label="Show the next nearest liquor store"
      >
        Not this one <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
