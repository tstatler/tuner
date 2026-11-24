/**
 * Precision Web Audio Metronome
 * Uses a lookahead scheduler (Chris Wilson pattern) to schedule clicks at exact
 * AudioContext hardware timestamps, avoiding JavaScript timer jitter.
 */

export const MIN_BPM = 30;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 120;

export const TIME_SIGNATURES = {
  '2/4': 2,
  '3/4': 3,
  '4/4': 4,
  '6/8': 6
};

export const CLICK_SOUNDS = ['woodblock', 'digital', 'soft'];

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;
const TAP_RESET_MS = 2500;
const MAX_TAP_HISTORY = 5;

export class Metronome {
  constructor(audioController, {
    bpm = DEFAULT_BPM,
    timeSignature = '4/4',
    sound = 'woodblock',
    volume = 0.7,
    onBeat = () => {},
    setIntervalFn = (fn, ms) => setInterval(fn, ms),
    clearIntervalFn = (id) => clearInterval(id),
    setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
    clearTimeoutFn = (id) => clearTimeout(id)
  } = {}) {
    this.audioController = audioController;
    this.bpm = this._clampBpm(bpm);
    this.timeSignature = TIME_SIGNATURES[timeSignature] ? timeSignature : '4/4';
    this.beatsPerMeasure = TIME_SIGNATURES[this.timeSignature];
    this.sound = CLICK_SOUNDS.includes(sound) ? sound : 'woodblock';
    this.volume = this._clampVolume(volume);
    this.onBeat = onBeat;

    this._setInterval = setIntervalFn;
    this._clearInterval = clearIntervalFn;
    this._setTimeout = setTimeoutFn;
    this._clearTimeout = clearTimeoutFn;

    this.isPlaying = false;
    this.currentBeat = 0;
    this.nextNoteTime = 0;
    this._schedulerTimerId = null;
    this._visualTimerIds = new Set();
    this._tapTimestamps = [];
  }

  _clampBpm(bpm) {
    const num = Math.round(Number(bpm));
    if (Number.isNaN(num)) return DEFAULT_BPM;
    return Math.max(MIN_BPM, Math.min(MAX_BPM, num));
  }

  _clampVolume(vol) {
    const num = Number(vol);
    if (Number.isNaN(num)) return 0.7;
    return Math.max(0, Math.min(1, num));
  }

  setBpm(bpm) {
    this.bpm = this._clampBpm(bpm);
    return this.bpm;
  }

  setTimeSignature(sig) {
    if (!TIME_SIGNATURES[sig]) return this.timeSignature;
    this.timeSignature = sig;
    this.beatsPerMeasure = TIME_SIGNATURES[sig];
    if (this.currentBeat >= this.beatsPerMeasure) {
      this.currentBeat = 0;
    }
    return this.timeSignature;
  }

  setSound(sound) {
    if (CLICK_SOUNDS.includes(sound)) {
      this.sound = sound;
    }
    return this.sound;
  }

  setVolume(vol) {
    this.volume = this._clampVolume(vol);
    return this.volume;
  }

  /**
   * Records a tempo tap and returns the computed BPM (or null on the first tap).
   */
  recordTap(nowMs = Date.now()) {
    if (
      this._tapTimestamps.length > 0 &&
      nowMs - this._tapTimestamps[this._tapTimestamps.length - 1] > TAP_RESET_MS
    ) {
      this._tapTimestamps = [];
    }

    this._tapTimestamps.push(nowMs);
    if (this._tapTimestamps.length > MAX_TAP_HISTORY) {
      this._tapTimestamps.shift();
    }

    if (this._tapTimestamps.length < 2) {
      return null;
    }

    let totalInterval = 0;
    for (let i = 1; i < this._tapTimestamps.length; i++) {
      totalInterval += this._tapTimestamps[i] - this._tapTimestamps[i - 1];
    }
    const avgInterval = totalInterval / (this._tapTimestamps.length - 1);
    if (avgInterval <= 0) return null;

    const computedBpm = this._clampBpm(60000 / avgInterval);
    this.setBpm(computedBpm);
    return computedBpm;
  }

  async start() {
    if (this.isPlaying) return;

    const ctx = await this.audioController.initAudioContext();
    this.isPlaying = true;
    this.currentBeat = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    // Schedule initial beat(s) immediately, then run lookahead loop
    this._scheduler();
    this._schedulerTimerId = this._setInterval(() => this._scheduler(), LOOKAHEAD_MS);
  }

  stop() {
    this.isPlaying = false;
    if (this._schedulerTimerId !== null) {
      this._clearInterval(this._schedulerTimerId);
      this._schedulerTimerId = null;
    }
    for (const id of this._visualTimerIds) {
      this._clearTimeout(id);
    }
    this._visualTimerIds.clear();
  }

  async toggle() {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      await this.start();
      return true;
    }
  }

  _scheduler() {
    if (!this.isPlaying) return;
    const ctx = this.audioController.audioContext;
    if (!ctx) return;

    // Guard against catch-up burst after backgrounding/sleep on iOS
    if (this.nextNoteTime < ctx.currentTime - 0.2) {
      this.nextNoteTime = ctx.currentTime + 0.05;
    }

    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this._scheduleNote(this.currentBeat, this.nextNoteTime);
      const secondsPerBeat = 60.0 / this.bpm;
      this.nextNoteTime += secondsPerBeat;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerMeasure;
    }
  }

  _scheduleNote(beatIndex, time) {
    const ctx = this.audioController.audioContext;
    if (!ctx) return;

    const isAccent = beatIndex === 0;
    this._synthesizeClick(ctx, time, isAccent);

    // Align visual beat callback with scheduled Web Audio time
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    let fired = false;
    let id = null;
    id = this._setTimeout(() => {
      fired = true;
      if (id !== null) {
        this._visualTimerIds.delete(id);
      }
      if (this.isPlaying) {
        this.onBeat(beatIndex, isAccent);
      }
    }, delayMs);
    if (!fired) {
      this._visualTimerIds.add(id);
    }
  }

  _synthesizeClick(ctx, time, isAccent) {
    if (this.volume <= 0) return;

    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.connect(gainNode);

    const peakGain = this.volume * (isAccent ? 0.9 : 0.6);

    if (this.sound === 'digital') {
      osc.type = isAccent ? 'square' : 'sine';
      osc.frequency.setValueAtTime(isAccent ? 1000 : 750, time);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.linearRampToValueAtTime(peakGain * 0.65, time + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
      osc.start(time);
      osc.stop(time + 0.05);
    } else if (this.sound === 'soft') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 660 : 440, time);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.linearRampToValueAtTime(peakGain * 0.75, time + 0.004);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.038);
      osc.start(time);
      osc.stop(time + 0.042);
    } else {
      // 'woodblock' (default): percussive resonant pitch drop
      osc.type = 'triangle';
      const startFreq = isAccent ? 1280 : 880;
      const endFreq = isAccent ? 960 : 660;
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.03);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.linearRampToValueAtTime(peakGain, time + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.038);
      osc.start(time);
      osc.stop(time + 0.042);
    }
  }
}
