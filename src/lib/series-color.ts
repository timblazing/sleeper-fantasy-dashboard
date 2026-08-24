/**
 * The categorical ramp defined in `globals.css`, addressed by index.
 *
 * Charts take colors from here rather than writing literal oklch values inline, so the palette
 * lives in the theme and follows light/dark without any component re-deciding what "emerald" is.
 * Indices wrap, so a 12-team league reuses hues rather than running off the end of the ramp.
 */
export const SERIES_COUNT = 8;

export const seriesColor = (index: number) => `var(--series-${(index % SERIES_COUNT) + 1})`;

/** Stable per-owner color: the same manager keeps their hue across every chart on the page. */
export function seriesColorFor(ownerId: string, order: string[]): string {
  const index = order.indexOf(ownerId);
  return seriesColor(index < 0 ? 0 : index);
}
