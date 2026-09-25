/**
 * The native twin of the browser's sound effects. The app carries no audio
 * library yet, so these do nothing on a phone build; the web app plays them.
 * Kept as a twin so callers need no platform check. Adding expo-audio here
 * would give the native app the same effects.
 */
export type SoundName = "trade";

export function preloadSounds(): void {}

export function playSound(_name: SoundName): void {}
