function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

/**
 * Open the user's default/native maps app pointed at a destination.
 * Prefers Apple Maps on iOS (opens the installed app directly), falls
 * back to a Google Maps URL everywhere else, which any platform can
 * resolve without an API key.
 */
export function openDirections(
  latitude: number,
  longitude: number,
  label: string
): void {
  const encodedLabel = encodeURIComponent(label);
  const url = isIOS()
    ? `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${encodedLabel}`
    : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  if (isIOS() || isAndroid()) {
    // On mobile, maps.apple.com and google.com/maps are registered
    // Universal Links / App Links - the OS intercepts a direct top-level
    // navigation and hands off to the native Maps app instead of ever
    // loading the URL in the browser. window.open() creates a *new*
    // browsing context, and that hand-off is unreliable through it -
    // especially inside a standalone (home-screen-installed) PWA, where
    // there's no real "new tab" to open. A direct navigation is what
    // Apple/Google's own docs recommend for triggering the hand-off.
    window.location.href = url;
  } else {
    // Desktop: there's no native app to hand off to, so open a new tab
    // and leave the compass running in the original one.
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
