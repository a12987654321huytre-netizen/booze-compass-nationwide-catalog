import type { StoreStatus } from '../types/store';

// The opening_hours parser is ~1MB unminified - far bigger than the rest
// of this app combined. It's only needed once we actually have a store
// with an opening_hours tag, so it's loaded lazily via dynamic import
// rather than bundled into the initial (instant-load) app shell.
type OpeningHoursCtor = new (value: string) => {
  getState: (at: Date) => boolean;
  getNextChange: (at: Date) => Date | undefined;
};

let parserPromise: Promise<OpeningHoursCtor> | null = null;

function loadParser(): Promise<OpeningHoursCtor> {
  if (!parserPromise) {
    parserPromise = import('opening_hours').then((mod) => mod.default as OpeningHoursCtor);
  }
  return parserPromise;
}

/**
 * Parse an OSM `opening_hours` string and return a confident open/closed
 * status, or 'unknown' if the tag is missing, malformed, or the library
 * can't evaluate it. We never guess - unknown stays unknown.
 */
export async function getStoreStatus(
  openingHours: string | undefined,
  at: Date = new Date()
): Promise<StoreStatus> {
  if (!openingHours || openingHours.trim().length === 0) {
    return { state: 'unknown' };
  }

  try {
    const OpeningHours = await loadParser();
    const oh = new OpeningHours(openingHours);
    const isOpen = oh.getState(at);

    if (isOpen) {
      const nextChange = oh.getNextChange(at);
      if (nextChange) {
        const time = nextChange.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return { state: 'open', label: `Open until ${time}` };
      }
      return { state: 'open' };
    }

    const nextChange = oh.getNextChange(at);
    if (nextChange) {
      const time = nextChange.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      return { state: 'closed', label: `Opens at ${time}` };
    }
    return { state: 'closed' };
  } catch {
    // Some OSM opening_hours tags are malformed free text. Don't invent a
    // status for data we can't confidently parse.
    return { state: 'unknown' };
  }
}
