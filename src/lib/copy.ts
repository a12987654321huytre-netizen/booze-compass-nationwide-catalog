/**
 * The Distance Ladder.
 *
 * 50 handwritten, deadpan lines across 500m bands from 0 to 25km,
 * escalating from "this is basically next door" to "this is a moerse
 * trek" as the distance climbs. This replaced an earlier randomized-
 * variant system entirely: the joke here is a specific, authored
 * narrative arc, so there's no seed/variety needed any more - the exact
 * distance maps directly to the exact line. Anything past 25km reuses
 * the final line; the punchline has already landed by then, and the
 * app's search cap is 50km so it needs to stay sensible out that far.
 *
 * Never add a line here that could read as encouraging drinking and
 * driving - see the "no drink-driving" guard test in copy.test.ts.
 */

const LADDER: string[] = [
  'So close it would be embarrassing to drive.',
  'Just down the road.',
  'A perfectly respectable bottle-store mission.',
  'Still lekker close.',
  'Close enough to commit.',
  'Bit of a trek, but nothing dramatic.',
  "Now we're missioning.",
  'This has become an outing.',
  'Not far. Shoes recommended.',
  'Okay, this is a proper mission now.',
  'Just past the five kay mark. Stay strong.',
  "We're getting into serious territory here.",
  'That bottle store better be worth it.',
  "Pack some water. We're going places.",
  "At this point, you're investing real time into this.",
  "Yoh. Surely there's something closer?",
  'The search is getting serious.',
  'You are practically a local at wherever this place is.',
  'Almost ten kays. Hope they have your brand.',
  'Double digits approaching.',
  'Ten kays down. The mission continues.',
  'At this point, check the specials first.',
  "This is no longer 'just popping out'.",
  "You're going to have to explain where you've been.",
  'Proper expedition territory.',
  'A solid journey for a bottle store.',
  'Let anyone at home know you might be a while.',
  'Are we even in the same municipality anymore?',
  'Just keep going. The compass knows the way.',
  'Fifteen kays. A scenic route, clearly.',
  "You're basically a tourist now.",
  'Hope your playlist is sorted.',
  'Ja, this is a proper trek.',
  'Somewhere out there, a bottle store awaits.',
  'You must really want to go to this specific store.',
  'Eighteen kays. Your dedication is noted.',
  'We are properly looking now.',
  'Is this still a run to the shops or a day trip?',
  'Just past nineteen. Keep the faith.',
  'Twenty kays. Respect the commitment.',
  "That's not nearby. That's a road trip.",
  "We've officially crossed into 'long haul' territory.",
  'Crossing provincial lines at this rate.',
  'Better be buying for a whole gathering.',
  'Twenty-two kays. A true test of character.',
  'Are there even people out here?',
  'This is a voyage of discovery.',
  'Barely clinging to the grid here.',
  'Right on the edge of the map.',
  "That is a moerse trek. You're going to need snacks.",
];

const BAND_METERS = 500;

/** Every non-negative distance maps to exactly one line - no gaps, no randomization. */
export function distanceQuip(meters: number): string {
  const index = Math.min(Math.floor(Math.max(meters, 0) / BAND_METERS), LADDER.length - 1);
  return LADDER[index];
}
