/**
 * Audio Controller
 * Manages Web Audio Context, Microphone Stream, Analyser Nodes, and Reference Tone Synthesizer
 */

export class AudioController {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.filterNode = null;
    this.analyserNode = null;
    this.visualizerAnalyser = null;
    this.timeBuffer = null;
    this.freqBuffer = null;
    this.activeOscillators = [];
    this.activeGainNodes = [];
    this.isListening = false;
    this.selectedDeviceId = null;
  }

  async initAudioContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  async startListening(deviceId = null) {
    await this.initAudioContext();
    if (deviceId) {
      this.selectedDeviceId = deviceId;
    }

    // Stop existing stream if running
    this.stopListening();

    const audioConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1
    };

    if (this.selectedDeviceId) {
      audioConstraints.deviceId = { exact: this.selectedDeviceId };
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Low-pass filter to clean up high-frequency noise and harmonics for guitar fundamentals
      this.filterNode = this.audioContext.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(950, this.audioContext.currentTime);
      this.filterNode.Q.setValueAtTime(1.0, this.audioContext.currentTime);

      // Analyser for pitch detection (needs larger buffer, e.g. 2048 or 4096)
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.timeBuffer = new Float32Array(this.analyserNode.fftSize);

      // Analyser for real-time visualizer (waveform & spectrum)
      this.visualizerAnalyser = this.audioContext.createAnalyser();
      this.visualizerAnalyser.fftSize = 256;
      this.visualizerAnalyser.smoothingTimeConstant = 0.8;
      this.freqBuffer = new Uint8Array(this.visualizerAnalyser.frequencyBinCount);

      // Connect graph:
      // Mic Source -> Lowpass Filter -> Pitch Analyser
      // Mic Source -> Visualizer Analyser
      this.sourceNode.connect(this.filterNode);
      this.filterNode.connect(this.analyserNode);
      this.sourceNode.connect(this.visualizerAnalyser);

      this.isListening = true;
      return true;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      this.isListening = false;
      throw err;
    }
  }

  stopListening() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }
    this.isListening = false;
  }

  getAudioData() {
    if (!this.isListening || !this.analyserNode) {
      return null;
    }
    this.analyserNode.getFloatTimeDomainData(this.timeBuffer);
    return this.timeBuffer;
  }

  getVisualizerData() {
    if (!this.isListening || !this.visualizerAnalyser) {
      return null;
    }
    this.visualizerAnalyser.getByteFrequencyData(this.freqBuffer);
    return this.freqBuffer;
  }

  getSampleRate() {
    return this.audioContext ? this.audioContext.sampleRate : 44100;
  }

  /**
   * Reference Tone Synthesizer
   * Creates a warm acoustic string-like timbre with fundamental and gentle harmonics
   */
  async playReferenceTone(frequency, type = 'acoustic', duration = 3.0) {
    await this.initAudioContext();
    this.stopReferenceTone();

    const now = this.audioContext.currentTime;
    const masterGain = this.audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.connect(this.audioContext.destination);

    const oscillators = [];

    if (type === 'pure') {
      // Clean sine wave
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      osc.connect(masterGain);
      osc.start(now);
      oscillators.push(osc);

      // Quick attack and smooth sustain/decay
      masterGain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
      if (duration > 0) {
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.stop(now + duration + 0.1);
      }
    } else {
      // Acoustic string pluck simulation:
      // Fundamental + 2nd Harmonic + 3rd Harmonic with progressive decay
      const harmonics = [
        { mult: 1, gain: 0.35, wave: 'triangle' },
        { mult: 2, gain: 0.15, wave: 'sine' },
        { mult: 3, gain: 0.08, wave: 'sine' },
        { mult: 4, gain: 0.03, wave: 'sine' },
      ];

      for (const h of harmonics) {
        const osc = this.audioContext.createOscillator();
        const hGain = this.audioContext.createGain();
        osc.type = h.wave;
        osc.frequency.setValueAtTime(frequency * h.mult, now);

        hGain.gain.setValueAtTime(h.gain, now);
        osc.connect(hGain);
        hGain.connect(masterGain);

        osc.start(now);
        oscillators.push(osc);
      }

      // Pluck envelope: quick 20ms attack, then natural guitar string exponential decay
      masterGain.gain.linearRampToValueAtTime(0.4, now + 0.02);
      if (duration > 0) {
        masterGain.gain.exponentialRampToValueAtTime(0.12, now + 0.8);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillators.forEach(osc => osc.stop(now + duration + 0.1));
      }
    }

    this.activeOscillators = oscillators;
    this.activeGainNodes = [masterGain];

    if (duration > 0) {
      setTimeout(() => {
        this.activeOscillators = [];
        this.activeGainNodes = [];
      }, (duration + 0.2) * 1000);
    }
  }

  stopReferenceTone() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    for (const gain of this.activeGainNodes) {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      } catch (e) {}
    }
    setTimeout(() => {
      for (const osc of this.activeOscillators) {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      }
      this.activeOscillators = [];
      this.activeGainNodes = [];
    }, 60);
  }

  async getAudioInputDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audioinput');
    } catch (err) {
      console.warn('Could not enumerate audio devices:', err);
      return [];
    }
  }
}
