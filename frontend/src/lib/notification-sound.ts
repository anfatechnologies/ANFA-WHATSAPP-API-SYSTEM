'use client';

// Lightweight Web Audio API "new message" notification beep.
// No audio file assets needed - synthesizes a short two-tone chime,
// so there's nothing to fetch/load and it works instantly.

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

/**
 * Plays a short notification chime. Call this directly from a place that
 * already checked the user's `notification_sound_enabled` setting - this
 * function itself does not read settings, to keep it a pure, reusable utility.
 */
export function playNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Browsers suspend AudioContext until a user gesture occurs on the page;
  // resume() is a no-op if it's already running.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      /* ignore - will simply not play until a user gesture unlocks audio */
    });
  }

  const now = ctx.currentTime;
  const tones = [
    { freq: 880, start: 0, duration: 0.09 },
    { freq: 1175, start: 0.09, duration: 0.12 },
  ];

  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = tone.freq;

    const startAt = now + tone.start;
    const endAt = startAt + tone.duration;

    // Quick fade in/out to avoid audible clicks.
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.15, startAt + 0.01);
    gain.gain.linearRampToValueAtTime(0, endAt);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startAt);
    osc.stop(endAt + 0.02);
  }
}
