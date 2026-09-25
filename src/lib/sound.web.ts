/**
 * Short effects, in the browser. A trade plays one the moment the swipe
 * completes.
 *
 * Browsers only let audio start from a gesture. The swipe is that gesture, so
 * `playSound` is called straight from the handler, before anything is
 * awaited. iOS additionally wants an element that has played at least once
 * inside a gesture, so the first touch anywhere primes it silently.
 */
export type SoundName = "trade";

const SOURCES: Record<SoundName, string> = {
  // Served from the app's own folder; `public/` is copied into the export.
  trade: "/app/sounds/buy-sell-audio.mp3",
};
const VOLUME = 0.5;

const cache = new Map<SoundName, HTMLAudioElement>();
let primed = false;

function element(name: SoundName): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  let el = cache.get(name);
  if (!el) {
    el = new Audio(SOURCES[name]);
    el.preload = "auto";
    el.volume = VOLUME;
    cache.set(name, el);
  }
  return el;
}

/** Loads the files and arranges for the first touch to unlock playback. */
export function preloadSounds(): void {
  if (typeof document === "undefined" || primed) return;
  primed = true;
  for (const name of Object.keys(SOURCES) as SoundName[]) element(name)?.load();
  const unlock = () => {
    for (const el of cache.values()) {
      const wasMuted = el.muted;
      el.muted = true;
      el
        .play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = wasMuted;
        })
        .catch(() => {
          el.muted = wasMuted;
        });
    }
  };
  // `once` so it costs one silent play, and passive so it never delays a tap.
  document.addEventListener("pointerdown", unlock, { once: true, passive: true });
}

/** Plays an effect. Never throws: a sound is not worth failing a trade over. */
export function playSound(name: SoundName): void {
  try {
    const el = element(name);
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  } catch {
    /* No sound is an acceptable outcome; the trade is what matters. */
  }
}
