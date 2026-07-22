/* ---------------------------------------------------------
   timer logic
--------------------------------------------------------- */
const display = document.getElementById('time-display');
const minInput = document.getElementById('min-input');
const secInput = document.getElementById('sec-input');
const setBtn = document.getElementById('set-btn');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const presetBtns = document.querySelectorAll('.preset');

let totalSeconds = 25 * 60;
let remaining = totalSeconds;
let intervalId = null;

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function updateDisplay() {
  display.textContent = formatTime(remaining);
}

function setControlsState(state) {
  startBtn.disabled = state === 'running';
  pauseBtn.disabled = state !== 'running';
  startBtn.textContent = state === 'paused' ? 'resume' : 'start';
}

function stopInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function setTimerFromInputs() {
  const min = Math.max(0, parseInt(minInput.value, 10) || 0);
  const sec = Math.max(0, Math.min(59, parseInt(secInput.value, 10) || 0));
  totalSeconds = min * 60 + sec;
  remaining = totalSeconds;
  updateDisplay();
  stopInterval();
  setControlsState('idle');
  pauseMusic();
}

function tick() {
  remaining -= 1;
  updateDisplay();
  if (remaining <= 0) {
    stopInterval();
    setControlsState('idle');
    onFinish();
  }
}

function start() {
  if (intervalId || remaining <= 0) return;
  setControlsState('running');
  intervalId = setInterval(tick, 1000);
  startMusic();
}

function pause() {
  stopInterval();
  setControlsState('paused');
  pauseMusic();
}

function reset() {
  stopInterval();
  remaining = totalSeconds;
  updateDisplay();
  setControlsState('idle');
  pauseMusic();
}

setBtn.addEventListener('click', setTimerFromInputs);
startBtn.addEventListener('click', start);
pauseBtn.addEventListener('click', pause);
resetBtn.addEventListener('click', reset);
presetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    minInput.value = btn.dataset.min;
    secInput.value = 0;
    setTimerFromInputs();
  });
});

updateDisplay();
setControlsState('idle');

/* ---------------------------------------------------------
   finish overlay + chroma-key green screen removal
--------------------------------------------------------- */
const overlay = document.getElementById('finish-overlay');
const dismissBtn = document.getElementById('dismiss-btn');
const sourceVideo = document.getElementById('source-video');
const keyCanvas = document.getElementById('key-canvas');
const keyCtx = keyCanvas.getContext('2d', { willReadFrequently: true });

let keyRafId = null;

// tune these two if your video's green shade needs a different cut
const GREEN_CUTOFF = 45; // "greenness" above this -> fully transparent
const FEATHER = 25; // soft edge band just below the cutoff

function drawKeyedFrame() {
  keyCtx.clearRect(0, 0, keyCanvas.width, keyCanvas.height);
  if (sourceVideo.readyState >= 2 && sourceVideo.videoWidth > 0) {
    keyCtx.drawImage(sourceVideo, 0, 0, keyCanvas.width, keyCanvas.height);
    const frame = keyCtx.getImageData(0, 0, keyCanvas.width, keyCanvas.height);
    const data = frame.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const greenness = g - Math.max(r, b);
      if (greenness > GREEN_CUTOFF) {
        data[i + 3] = 0;
      } else if (greenness > GREEN_CUTOFF - FEATHER) {
        const alpha = 1 - (greenness - (GREEN_CUTOFF - FEATHER)) / FEATHER;
        data[i + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
        data[i + 1] = Math.min(g, Math.max(r, b)); // suppress green spill on the edge
      }
    }
    keyCtx.putImageData(frame, 0, 0);
  }
  keyRafId = requestAnimationFrame(drawKeyedFrame);
}

function onFinish() {
  overlay.classList.remove('hidden');
  stopMusicLoop();
  sourceVideo.currentTime = 0;
  sourceVideo.muted = false;
  sourceVideo.volume = 1;
  sourceVideo.play().catch(() => {
  });
  drawKeyedFrame();
}

function closeOverlay() {
  overlay.classList.add('hidden');
  sourceVideo.pause();
  if (keyRafId) cancelAnimationFrame(keyRafId);
  keyRafId = null;
}

dismissBtn.addEventListener('click', () => {
  closeOverlay();
  reset();
});

/* ---------------------------------------------------------
   original chiptune loop, playing during the countdown (Web Audio API)
--------------------------------------------------------- */
let audioCtx = null;
let musicTimer = null;
let musicStep = 0;
let musicMuted = false;
let nextNoteTime = 0;

const BPM = 100;
const STEP_DUR = 60 / BPM / 2; // eighth notes
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;

// cute little pentatonic melody + bass, with rests as null
const MELODY = [
  523.25, null, 587.33, 659.25, null, 587.33, 523.25, null,
  440.0, null, 523.25, 440.0, null, 392.0, 440.0, null,
];
const BASS = [130.81, null, null, null, 146.83, null, null, null];

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playNote(freq, time, duration, type, peakGain) {
  const ctx = ensureAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peakGain, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + duration);
}

function scheduler() {
  const ctx = ensureAudioCtx();
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
    if (!musicMuted) {
      const note = MELODY[musicStep % MELODY.length];
      if (note) playNote(note, nextNoteTime, STEP_DUR * 0.9, 'square', 0.05);
      const bassNote = BASS[musicStep % BASS.length];
      if (bassNote) playNote(bassNote, nextNoteTime, STEP_DUR * 1.8, 'triangle', 0.08);
    }
    nextNoteTime += STEP_DUR;
    musicStep++;
  }
  musicTimer = setTimeout(scheduler, LOOKAHEAD_MS);
}

function startMusic() {
  const ctx = ensureAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  if (musicTimer) return;
  nextNoteTime = ctx.currentTime + 0.05;
  scheduler();
}

function pauseMusic() {
  stopMusicLoop();
}

function stopMusicLoop() {
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  musicMuted = !musicMuted;
  muteBtn.textContent = musicMuted ? '🔇' : '🔊';
});
