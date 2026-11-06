// Web Audio API Sound Generator for Floating AI Predator HUD

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

// Win chime sound
export function playWinSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(523.25, now); // C5
  osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
  osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
  osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.6);
}

// Win Fanfare & Spoken "You Win!" Voice Audio Announcement
export function playYouWinVoice() {
  const ctx = getAudioContext();
  if (ctx) {
    const now = ctx.currentTime;

    // 1. Triumphant Fanfare Chime (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.18, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.5);
    });

    // 2. Resonant Arcade "YOU - WIN!" Acoustic Synthesizer Accents
    // First Syllable "YOU" (D5 -> G5 rise)
    const youOsc = ctx.createOscillator();
    const youGain = ctx.createGain();
    youOsc.type = 'sine';
    youOsc.frequency.setValueAtTime(587.33, now + 0.12);
    youOsc.frequency.exponentialRampToValueAtTime(783.99, now + 0.32);
    youGain.gain.setValueAtTime(0.16, now + 0.12);
    youGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    youOsc.connect(youGain);
    youGain.connect(ctx.destination);
    youOsc.start(now + 0.12);
    youOsc.stop(now + 0.36);

    // Second Syllable "WIN!" (A5 -> D6 triumphant peak)
    const winOsc = ctx.createOscillator();
    const winGain = ctx.createGain();
    winOsc.type = 'sine';
    winOsc.frequency.setValueAtTime(880.00, now + 0.38);
    winOsc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.65);
    winGain.gain.setValueAtTime(0.20, now + 0.38);
    winGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    winOsc.connect(winGain);
    winGain.connect(ctx.destination);
    winOsc.start(now + 0.38);
    winOsc.stop(now + 0.85);
  }

  // 3. Clear Natural "You Win!" Spoken Voice via Web Speech Synthesis API
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // clear previous speech queue
      const utterance = new SpeechSynthesisUtterance('You Win!');
      utterance.lang = 'en-US';
      utterance.pitch = 1.35; // energetic, upbeat victorious pitch
      utterance.rate = 1.05; // snappy arcade voice
      utterance.volume = 1.0;

      // Select high quality voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Alex'))
      ) || voices.find((v) => v.lang.startsWith('en'));

      if (preferred) {
        utterance.voice = preferred;
      }

      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.warn('Speech synthesis voice warning:', err);
  }
}

// Sci-fi Radar Lock / New Prediction Alert
export function playRadarLockSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

// Countdown Tick (Last 5 seconds)
export function playTickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(800, now);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}

// Admin Unlocked Sci-fi Chord
export function playAdminUnlockedSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const frequencies = [440, 554.37, 659.25, 880];

  frequencies.forEach((freq, idx) => {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + idx * 0.06);

    gain.gain.setValueAtTime(0.08, now + idx * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.06);
    osc.stop(now + idx * 0.06 + 0.4);
  });
}

// Authentic Myanmar Spoken Vocal for Target Profit:
// "ဂုဏ်ယူပါတယ် မင်းသတ်မှတ်ထားသောအမြတ်ငွေကိုရရှိပါပြီ"
export function playMyanmarTargetProfitVoice(): Promise<void> {
  return new Promise((resolve) => {
    // 1. Play celebratory fanfare chime
    playWinSound();

    let audioPlayed = false;

    // 2. Play native authentic Burmese audio stream from /api/audio/target-profit-burmese
    try {
      const audio = new Audio('/api/audio/target-profit-burmese');
      audio.volume = 1.0;
      audio.onended = () => {
        resolve();
      };
      audio.onerror = () => {
        fallbackWebSpeech();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            audioPlayed = true;
          })
          .catch((err) => {
            console.warn('Audio tag play note, falling back to Web Speech:', err);
            fallbackWebSpeech();
          });
      }
    } catch (e) {
      fallbackWebSpeech();
    }

    // 3. Web Speech API fallback
    function fallbackWebSpeech() {
      if (audioPlayed) return;
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const text = 'ဂုဏ်ယူပါတယ် မင်းသတ်မှတ်ထားသောအမြတ်ငွေကိုရရှိပါပြီ';
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'my-MM';
          utterance.pitch = 1.1;
          utterance.rate = 0.95;
          utterance.volume = 1.0;

          const voices = window.speechSynthesis.getVoices();
          const myVoice = voices.find(
            (v) => v.lang.startsWith('my') || v.name.toLowerCase().includes('myanmar') || v.name.toLowerCase().includes('burmese')
          );
          if (myVoice) {
            utterance.voice = myVoice;
          }

          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        } else {
          resolve();
        }
      } catch (err) {
        console.warn('Web speech fallback note:', err);
        resolve();
      }
    }
  });
}
