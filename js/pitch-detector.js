/**
 * High-Precision Monophonic Audio Pitch Detector
 * Optimized for string instruments (Guitar, Bass, Ukulele).
 * Utilizes Normalized Autocorrelation with Parabolic Peak Interpolation and RMS noise gating.
 */

export class PitchDetector {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
    this.minFreq = 55;   // ~A1 (supports bass & drop tunings)
    this.maxFreq = 1100; // ~C6 (supports high harmonics and fretboard range)
    this.clarityThreshold = 0.82; // Normalized autocorrelation peak threshold
    this.sensitivity = 0.015;     // RMS noise gate threshold
    
    // History buffer for stability smoothing
    this.pitchHistory = [];
    this.historyLength = 5;
  }

  setSampleRate(rate) {
    this.sampleRate = rate;
  }

  setSensitivity(val) {
    // val between 0.005 (very sensitive) and 0.08 (high noise gate)
    this.sensitivity = Math.max(0.002, Math.min(0.1, val));
  }

  /**
   * Calculates Root Mean Square (RMS) volume of the audio buffer
   */
  getRMS(buffer) {
    let sum = 0;
    const len = buffer.length;
    for (let i = 0; i < len; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / len);
  }

  /**
   * Detects fundamental frequency using Normalized Square Difference / Autocorrelation
   * @param {Float32Array} buffer - Time domain audio sample buffer
   * @returns {{ frequency: number, clarity: number, rms: number }}
   */
  detectPitch(buffer) {
    const rms = this.getRMS(buffer);
    if (rms < this.sensitivity) {
      this.pitchHistory = [];
      return { frequency: -1, clarity: 0, rms };
    }

    const bufferSize = buffer.length;
    const minPeriod = Math.floor(this.sampleRate / this.maxFreq);
    const maxPeriod = Math.floor(this.sampleRate / this.minFreq);

    if (bufferSize < maxPeriod * 2) {
      // Buffer too small for the lowest frequency requested
      return { frequency: -1, clarity: 0, rms };
    }

    // Autocorrelation calculation with normalization
    const correlation = new Float32Array(maxPeriod + 2);

    for (let lag = 1; lag <= maxPeriod + 1; lag++) {
      let sum = 0;
      let norm1 = 0;
      let norm2 = 0;

      const windowLen = bufferSize - lag;
      for (let i = 0; i < windowLen; i++) {
        const x1 = buffer[i];
        const x2 = buffer[i + lag];
        sum += x1 * x2;
        norm1 += x1 * x1;
        norm2 += x2 * x2;
      }

      const norm = Math.sqrt(norm1 * norm2);
      correlation[lag] = norm > 1e-6 ? sum / norm : 0;
    }

    // 1. Identify all local maxima within valid period range
    const peaks = [];
    let globalMaxR = 0;

    for (let lag = minPeriod; lag <= maxPeriod; lag++) {
      const r = correlation[lag];
      if (r > 0 && r > correlation[lag - 1] && r >= correlation[lag + 1]) {
        peaks.push(lag);
        if (r > globalMaxR) {
          globalMaxR = r;
        }
      }
    }

    if (peaks.length === 0 || globalMaxR < this.clarityThreshold) {
      return { frequency: -1, clarity: globalMaxR, rms };
    }

    // 2. McLeod Pitch Method (MPM) peak selection:
    // Select the FIRST local peak whose correlation is at least 85% of globalMaxR.
    // This rigorously prevents octave halving (picking 2T, 3T subharmonics).
    const cutoff = globalMaxR * 0.86;
    let bestOffset = -1;
    for (const lag of peaks) {
      if (correlation[lag] >= cutoff) {
        bestOffset = lag;
        break;
      }
    }

    if (bestOffset === -1) {
      bestOffset = peaks[0];
    }

    // Refine peak with parabolic interpolation:
    // delta = (y[k-1] - y[k+1]) / (2 * (y[k-1] - 2*y[k] + y[k+1]))
    const k = bestOffset;
    const y1 = correlation[k - 1];
    const y2 = correlation[k];
    const y3 = correlation[k + 1];

    let delta = 0;
    const denominator = 2 * (y1 - 2 * y2 + y3);
    if (Math.abs(denominator) > 1e-6) {
      delta = (y1 - y3) / denominator;
      // Clamp delta to [-1, 1]
      delta = Math.max(-1, Math.min(1, delta));
    }

    const refinedPeriod = bestOffset + delta;
    const rawFrequency = this.sampleRate / refinedPeriod;

    if (rawFrequency < this.minFreq || rawFrequency > this.maxFreq) {
      return { frequency: -1, clarity: 0, rms };
    }

    // If frequency jumps by more than 8% (~1.3 semitones), reset history to avoid blending different notes
    if (this.pitchHistory.length > 0) {
      const lastFreq = this.pitchHistory[this.pitchHistory.length - 1];
      if (Math.abs(rawFrequency - lastFreq) / lastFreq > 0.08) {
        this.pitchHistory = [];
      }
    }

    // Temporal median filter to avoid momentary flutter/glitches on the same note
    this.pitchHistory.push(rawFrequency);
    if (this.pitchHistory.length > this.historyLength) {
      this.pitchHistory.shift();
    }

    const smoothedFrequency = this._getMedian(this.pitchHistory);

    return {
      frequency: smoothedFrequency,
      rawFrequency,
      clarity: globalMaxR,
      rms
    };
  }

  _getMedian(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  reset() {
    this.pitchHistory = [];
  }
}
