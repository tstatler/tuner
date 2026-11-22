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
    this.silentGainNode = null;
    this.timeBuffer = null;
    this.byteTimeBuffer = null;
    this.freqBuffer = null;
    this.activeOscillators = [];
    this.activeGainNodes = [];
    this.isListening = false;
    this.selectedDeviceId = null;
  }

  async initAudioContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.audioContext.onstatechange = () => {
        if (
          this.isListening &&
          this.audioContext &&
          (this.audioContext.state === 'suspended' || this.audioContext.state === 'interrupted')
        ) {
          this.audioContext.resume().catch(() => {});
        }
      };
    }
    if (this.audioContext.state !== 'running') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  async ensureRunning() {
    if (this.audioContext && this.audioContext.state !== 'running' && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.resume();
      } catch (e) {}
    }
  }

  async _getMicrophoneStream(audioConstraints) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false
      });
    } catch (err) {
      if (err && (err.name === 'OverconstrainedError' || err.name === 'TypeError')) {
        // Retry without deviceId/channelCount constraints (common iOS WebKit quirk)
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            },
            video: false
          });
        } catch (fallbackErr) {
          if (fallbackErr && (fallbackErr.name === 'OverconstrainedError' || fallbackErr.name === 'TypeError')) {
            return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          }
          throw fallbackErr;
        }
      }
      throw err;
    }
  }

  async startListening(deviceId = null) {
    // Initialize & resume AudioContext synchronously inside the user gesture before awaiting getUserMedia
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
      this.mediaStream = await this._getMicrophoneStream(audioConstraints);

      // On iOS Safari/Firefox (WebKit), the microphone permission prompt or AVAudioSession switch
      // often transitions the AudioContext to 'suspended' or 'interrupted'. Resume it again here.
      await this.ensureRunning();

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Low-pass filter to clean up high-frequency noise and harmonics for guitar fundamentals
      this.filterNode = this.audioContext.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(950, this.audioContext.currentTime);
      this.filterNode.Q.setValueAtTime(1.0, this.audioContext.currentTime);

      // Analyser for pitch detection (use 4096 at high sample rates > 48kHz so low notes fit)
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = this.audioContext.sampleRate > 48000 ? 4096 : 2048;
      this.timeBuffer = new Float32Array(this.analyserNode.fftSize);
      this.byteTimeBuffer = new Uint8Array(this.analyserNode.fftSize);

      // Analyser for real-time visualizer (waveform & spectrum)
      this.visualizerAnalyser = this.audioContext.createAnalyser();
      this.visualizerAnalyser.fftSize = 256;
      this.visualizerAnalyser.smoothingTimeConstant = 0.8;
      this.freqBuffer = new Uint8Array(this.visualizerAnalyser.frequencyBinCount);

      // Silent gain sink connected to destination:
      // Required on iOS Safari & iOS Firefox (WebKit) so the audio engine pulls frames through
      // the MediaStreamSource -> Analyser graph without outputting mic feedback to speakers.
      this.silentGainNode = this.audioContext.createGain();
      this.silentGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);

      // Connect graph:
      // Mic Source -> Lowpass Filter -> Pitch Analyser -> Silent Gain -> Destination
      // Mic Source -> Visualizer Analyser -> Silent Gain -> Destination
      this.sourceNode.connect(this.filterNode);
      this.filterNode.connect(this.analyserNode);
      this.analyserNode.connect(this.silentGainNode);
      this.sourceNode.connect(this.visualizerAnalyser);
      this.visualizerAnalyser.connect(this.silentGainNode);
      this.silentGainNode.connect(this.audioContext.destination);

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
    const nodes = [
      this.sourceNode,
      this.filterNode,
      this.analyserNode,
      this.visualizerAnalyser,
      this.silentGainNode
    ];
    for (const node of nodes) {
      if (node) {
        try {
          node.disconnect();
        } catch (e) {}
      }
    }
    this.sourceNode = null;
    this.filterNode = null;
    this.analyserNode = null;
    this.visualizerAnalyser = null;
    this.silentGainNode = null;
    this.isListening = false;
  }

  getAudioData() {
    if (!this.isListening || !this.analyserNode) {
      return null;
    }
    if (this.audioContext && this.audioContext.state !== 'running' && this.audioContext.state !== 'closed') {
      this.audioContext.resume().catch(() => {});
    }
    if (typeof this.analyserNode.getFloatTimeDomainData === 'function') {
      this.analyserNode.getFloatTimeDomainData(this.timeBuffer);
    } else {
      this.analyserNode.getByteTimeDomainData(this.byteTimeBuffer);
      for (let i = 0; i < this.byteTimeBuffer.length; i++) {
        this.timeBuffer[i] = (this.byteTimeBuffer[i] - 128) / 128;
      }
    }
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
   * Creates a warm acoustic string-like timbre or pure sine wave with smooth ADSR envelope.
   */
  async playReferenceTone(frequency, type = 'acoustic', duration = 3.0) {
    if (!frequency || isNaN(frequency) || frequency <= 0) return;

    await this.initAudioContext();
    this.stopReferenceTone();

    // Schedule slightly in advance to guarantee all nodes receive events cleanly
    const now = this.audioContext.currentTime + 0.02;

    const masterGain = this.audioContext.createGain();
    // Start at silence
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

      // Volume envelope (peak 0.45)
      masterGain.gain.linearRampToValueAtTime(0.45, now + 0.05);
      if (duration > 0) {
        masterGain.gain.setValueAtTime(0.45, now + duration - 0.2);
        masterGain.gain.linearRampToValueAtTime(0.0001, now + duration);
        osc.stop(now + duration + 0.05);
      }
    } else {
      // Acoustic string pluck simulation:
      // Fundamental + 2nd, 3rd, 4th harmonics for a warm guitar timbre
      const harmonics = [
        { mult: 1, gain: 0.50, wave: 'triangle' },
        { mult: 2, gain: 0.25, wave: 'sine' },
        { mult: 3, gain: 0.12, wave: 'sine' },
        { mult: 4, gain: 0.06, wave: 'sine' }
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

      // Pluck attack (25ms) to clear, audible peak volume (0.55),
      // then decay gently mimicking a ringing acoustic guitar string
      masterGain.gain.linearRampToValueAtTime(0.55, now + 0.025);
      if (duration > 0) {
        masterGain.gain.linearRampToValueAtTime(0.25, now + 0.6);
        masterGain.gain.linearRampToValueAtTime(0.12, now + 1.8);
        masterGain.gain.linearRampToValueAtTime(0.0001, now + duration);
        oscillators.forEach(osc => {
          try {
            osc.stop(now + duration + 0.05);
          } catch (e) {}
        });
      }
    }

    this.activeOscillators = oscillators;
    this.activeGainNodes = [masterGain];

    if (duration > 0) {
      const cleanupTimer = setTimeout(() => {
        if (this.activeOscillators === oscillators) {
          this.activeOscillators = [];
          this.activeGainNodes = [];
        }
      }, (duration + 0.2) * 1000);
      this.currentToneTimer = cleanupTimer;
    }
  }

  stopReferenceTone() {
    if (this.currentToneTimer) {
      clearTimeout(this.currentToneTimer);
      this.currentToneTimer = null;
    }

    if (!this.audioContext || this.activeOscillators.length === 0) {
      return;
    }

    const now = this.audioContext.currentTime;
    const oldGains = [...this.activeGainNodes];
    const oldOscs = [...this.activeOscillators];
    
    // Clear references immediately so subsequent calls won't stop newly started tones
    this.activeGainNodes = [];
    this.activeOscillators = [];

    // Smooth quick fade-out of old sounds to avoid any audible pop/click
    for (const gain of oldGains) {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
        gain.gain.linearRampToValueAtTime(0.0001, now + 0.03);
      } catch (e) {}
    }

    setTimeout(() => {
      for (const osc of oldOscs) {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      }
    }, 40);
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
