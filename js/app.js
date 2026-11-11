/**
 * Main Application Orchestrator
 * Connects Audio Controller, Pitch Detector, Canvas Gauge, Tunings, and UI Events
 */

import { TUNING_PRESETS, getFrequency, frequencyToNote, findClosestString, calculateCents, NOTE_NAMES } from './tunings.js';
import { PitchDetector } from './pitch-detector.js';
import { AudioController } from './audio-controller.js';
import { TunerGauge } from './gauge.js';

class GuitarTunerApp {
  constructor() {
    this.audioController = new AudioController();
    this.pitchDetector = new PitchDetector(44100);

    // Application State
    this.currentTuning = TUNING_PRESETS[0]; // Standard tuning
    this.tunerMode = 'guitar'; // 'guitar' | 'chromatic'
    this.selectedStringIndex = null; // null for auto-detect, or string number/index
    this.a4Frequency = 440;
    this.isListening = false;
    this.animFrameId = null;
    this.lastPitchTimestamp = 0;
    this.activeNoteDisplayTimeout = null;

    // DOM Elements
    this.dom = {
      tuningSelect: document.getElementById('tuningSelect'),
      modeGuitarBtn: document.getElementById('modeGuitarBtn'),
      modeChromaticBtn: document.getElementById('modeChromaticBtn'),
      micToggleBtn: document.getElementById('micToggleBtn'),
      micBtnText: document.getElementById('micBtnText'),
      statusBanner: document.getElementById('statusBanner'),
      
      // Hero Note Display
      detectedNote: document.getElementById('detectedNote'),
      detectedOctave: document.getElementById('detectedOctave'),
      tuningStatusTag: document.getElementById('tuningStatusTag'),
      noteHero: document.querySelector('.note-hero'),

      // Telemetry
      detectedFreq: document.getElementById('detectedFreq'),
      targetFreq: document.getElementById('targetFreq'),
      centsOffset: document.getElementById('centsOffset'),
      telemetryA4: document.getElementById('telemetryA4'),

      // Canvas
      gaugeCanvas: document.getElementById('gaugeCanvas'),
      waveformCanvas: document.getElementById('waveformCanvas'),

      // Strings
      stringsContainer: document.getElementById('stringsContainer'),
      autoDetectStringBtn: document.getElementById('autoDetectStringBtn'),
      stringsSubtitle: document.getElementById('stringsSubtitle'),

      // Tone Generator Bar
      toneTimbreSelect: document.getElementById('toneTimbreSelect'),
      toneNoteSelect: document.getElementById('toneNoteSelect'),
      playToneBtn: document.getElementById('playToneBtn'),
      stopToneBtn: document.getElementById('stopToneBtn'),

      // Visualizer
      signalLevelText: document.getElementById('signalLevelText'),

      // Settings Dialog
      settingsDialog: document.getElementById('settingsDialog'),
      openSettingsBtn: document.getElementById('openSettingsBtn'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      a4Slider: document.getElementById('a4Slider'),
      a4ValueLabel: document.getElementById('a4ValueLabel'),
      sensitivitySlider: document.getElementById('sensitivitySlider'),
      sensitivityValueLabel: document.getElementById('sensitivityValueLabel'),
      audioDeviceSelect: document.getElementById('audioDeviceSelect'),
      presetPills: document.querySelectorAll('.pill-btn')
    };

    // Gauge Instance
    this.gauge = new TunerGauge(this.dom.gaugeCanvas);

    // Waveform visualizer context
    this.waveCtx = this.dom.waveformCanvas.getContext('2d');
  }

  init() {
    this.populateTuningsDropdown();
    this.populateToneGeneratorNotes();
    this.renderStrings();
    this.bindEvents();
    this.updateSensitivityFromSlider();
    this.startRenderLoop();
  }

  populateTuningsDropdown() {
    this.dom.tuningSelect.innerHTML = '';
    const categories = {};

    TUNING_PRESETS.forEach(tuning => {
      if (!categories[tuning.category]) {
        categories[tuning.category] = [];
      }
      categories[tuning.category].push(tuning);
    });

    for (const [catName, tunings] of Object.entries(categories)) {
      const optGroup = document.createElement('optgroup');
      optGroup.label = catName;
      tunings.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        optGroup.appendChild(opt);
      });
      this.dom.tuningSelect.appendChild(optGroup);
    }
  }

  populateToneGeneratorNotes() {
    this.dom.toneNoteSelect.innerHTML = '';
    // Provide standard string tones plus octave 2, 3, 4 notes
    const commonNotes = [
      { name: 'E2', note: 'E', oct: 2 },
      { name: 'A2', note: 'A', oct: 2 },
      { name: 'D3', note: 'D', oct: 3 },
      { name: 'G3', note: 'G', oct: 3 },
      { name: 'B3', note: 'B', oct: 3 },
      { name: 'E4', note: 'E', oct: 4 },
      { name: 'A4 (440Hz)', note: 'A', oct: 4 },
      { name: 'C3', note: 'C', oct: 3 },
      { name: 'C4 (Middle C)', note: 'C', oct: 4 }
    ];

    commonNotes.forEach(item => {
      const opt = document.createElement('option');
      opt.value = `${item.note}_${item.oct}`;
      const freq = getFrequency(item.note, item.oct, this.a4Frequency);
      opt.textContent = `${item.name} (${freq.toFixed(1)} Hz)`;
      this.dom.toneNoteSelect.appendChild(opt);
    });
  }

  renderStrings() {
    this.dom.stringsContainer.innerHTML = '';
    const strings = this.currentTuning.strings;

    strings.forEach((str, index) => {
      const freq = getFrequency(str.note, str.octave, this.a4Frequency);
      const card = document.createElement('div');
      card.className = 'string-card';
      card.dataset.stringIndex = index;
      if (this.selectedStringIndex === index) {
        card.classList.add('selected');
      }

      card.innerHTML = `
        <span class="string-num-badge">${str.num}</span>
        <span class="string-note-name">${str.name || str.note}</span>
        <span class="string-target-freq">${freq.toFixed(1)} Hz</span>
        <button class="string-listen-btn" title="Hear ${str.name || str.note} reference tone" aria-label="Play reference pitch for string ${str.num}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      `;

      // Click card body to lock onto string
      card.addEventListener('click', (e) => {
        if (e.target.closest('.string-listen-btn')) {
          e.stopPropagation();
          this.playStringReferenceTone(str, freq, card);
          return;
        }
        this.selectString(index);
      });

      this.dom.stringsContainer.appendChild(card);
    });
  }

  selectString(index) {
    if (this.selectedStringIndex === index) {
      // Toggle back to auto
      this.selectedStringIndex = null;
      this.dom.autoDetectStringBtn.classList.add('active');
      this.dom.stringsSubtitle.textContent = 'Auto string tracking active (plays any string)';
    } else {
      this.selectedStringIndex = index;
      this.dom.autoDetectStringBtn.classList.remove('active');
      const str = this.currentTuning.strings[index];
      this.dom.stringsSubtitle.textContent = `Target locked to String ${str.num} (${str.name || str.note})`;
    }
    this.highlightStringCards();
  }

  highlightStringCards(matchedIndex = null, inTune = false) {
    const cards = this.dom.stringsContainer.querySelectorAll('.string-card');
    cards.forEach((card, idx) => {
      card.classList.remove('selected', 'in-tune');
      if (this.selectedStringIndex !== null && this.selectedStringIndex === idx) {
        card.classList.add('selected');
      } else if (this.selectedStringIndex === null && matchedIndex === idx) {
        card.classList.add('selected');
      }
      if (inTune && (this.selectedStringIndex === idx || (this.selectedStringIndex === null && matchedIndex === idx))) {
        card.classList.add('in-tune');
      }
    });
  }

  playStringReferenceTone(stringObj, frequency, cardEl) {
    const timbre = this.dom.toneTimbreSelect.value;
    this.audioController.playReferenceTone(frequency, timbre, 2.5);
    cardEl.classList.add('playing');
    setTimeout(() => {
      cardEl.classList.remove('playing');
    }, 2500);
  }

  bindEvents() {
    // Tuning change
    this.dom.tuningSelect.addEventListener('change', (e) => {
      const selected = TUNING_PRESETS.find(t => t.id === e.target.value);
      if (selected) {
        this.currentTuning = selected;
        this.selectedStringIndex = null;
        this.dom.autoDetectStringBtn.classList.add('active');
        this.renderStrings();
      }
    });

    // Mode Toggle
    this.dom.modeGuitarBtn.addEventListener('click', () => this.setMode('guitar'));
    this.dom.modeChromaticBtn.addEventListener('click', () => this.setMode('chromatic'));

    // Auto String Track Button
    this.dom.autoDetectStringBtn.addEventListener('click', () => {
      this.selectedStringIndex = null;
      this.dom.autoDetectStringBtn.classList.add('active');
      this.dom.stringsSubtitle.textContent = 'Auto string tracking active (plays any string)';
      this.highlightStringCards();
    });

    // Mic Toggle
    this.dom.micToggleBtn.addEventListener('click', () => this.toggleMicrophone());

    // Tone Generator Play / Stop
    this.dom.playToneBtn.addEventListener('click', () => {
      const [note, octStr] = this.dom.toneNoteSelect.value.split('_');
      const octave = parseInt(octStr, 10);
      const freq = getFrequency(note, octave, this.a4Frequency);
      const timbre = this.dom.toneTimbreSelect.value;

      this.audioController.playReferenceTone(freq, timbre, 4.0);
      this.dom.playToneBtn.classList.add('hidden');
      this.dom.stopToneBtn.classList.remove('hidden');

      setTimeout(() => {
        this.dom.playToneBtn.classList.remove('hidden');
        this.dom.stopToneBtn.classList.add('hidden');
      }, 4000);
    });

    this.dom.stopToneBtn.addEventListener('click', () => {
      this.audioController.stopReferenceTone();
      this.dom.playToneBtn.classList.remove('hidden');
      this.dom.stopToneBtn.classList.add('hidden');
    });

    // Settings Modal
    this.dom.openSettingsBtn.addEventListener('click', () => {
      this.populateAudioDevices();
      this.dom.settingsDialog.showModal();
    });

    this.dom.closeSettingsBtn.addEventListener('click', () => {
      this.dom.settingsDialog.close();
    });

    this.dom.saveSettingsBtn.addEventListener('click', () => {
      this.dom.settingsDialog.close();
    });

    // A4 Slider & Presets
    this.dom.a4Slider.addEventListener('input', (e) => {
      this.setA4Frequency(parseInt(e.target.value, 10));
    });

    this.dom.presetPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const val = parseInt(pill.dataset.a4, 10);
        this.setA4Frequency(val);
      });
    });

    // Sensitivity Slider
    this.dom.sensitivitySlider.addEventListener('input', () => {
      this.updateSensitivityFromSlider();
    });

    // Device switch
    this.dom.audioDeviceSelect.addEventListener('change', async (e) => {
      if (this.isListening) {
        try {
          await this.audioController.startListening(e.target.value);
          this.showStatus('Switched audio input device', 'info', 2000);
        } catch (err) {
          this.showStatus('Failed to switch audio input device', 'error', 4000);
        }
      }
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.toggleMicrophone();
      } else if (e.key >= '1' && e.key <= '6') {
        // Trigger string 1-6 reference tone
        const num = parseInt(e.key, 10);
        const strIndex = this.currentTuning.strings.findIndex(s => s.num === num);
        if (strIndex !== -1) {
          const str = this.currentTuning.strings[strIndex];
          const freq = getFrequency(str.note, str.octave, this.a4Frequency);
          const cards = this.dom.stringsContainer.querySelectorAll('.string-card');
          if (cards[strIndex]) {
            this.playStringReferenceTone(str, freq, cards[strIndex]);
          }
        }
      }
    });
  }

  setMode(mode) {
    this.tunerMode = mode;
    if (mode === 'guitar') {
      this.dom.modeGuitarBtn.classList.add('active');
      this.dom.modeGuitarBtn.setAttribute('aria-checked', 'true');
      this.dom.modeChromaticBtn.classList.remove('active');
      this.dom.modeChromaticBtn.setAttribute('aria-checked', 'false');
    } else {
      this.dom.modeChromaticBtn.classList.add('active');
      this.dom.modeChromaticBtn.setAttribute('aria-checked', 'true');
      this.dom.modeGuitarBtn.classList.remove('active');
      this.dom.modeGuitarBtn.setAttribute('aria-checked', 'false');
    }
  }

  setA4Frequency(freq) {
    this.a4Frequency = freq;
    this.dom.a4Slider.value = freq;
    this.dom.a4ValueLabel.textContent = `${freq} Hz`;
    this.dom.telemetryA4.textContent = `${freq} Hz`;

    this.dom.presetPills.forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.a4, 10) === freq);
    });

    this.renderStrings();
    this.populateToneGeneratorNotes();
  }

  updateSensitivityFromSlider() {
    const val = parseInt(this.dom.sensitivitySlider.value, 10);
    // 1: High Sensitivity (0.005) -> 5: High Noise Filter (0.04)
    const map = {
      1: { rms: 0.005, label: 'Highest' },
      2: { rms: 0.010, label: 'High' },
      3: { rms: 0.015, label: 'Normal' },
      4: { rms: 0.025, label: 'Filtered' },
      5: { rms: 0.040, label: 'Maximum Noise Gate' }
    };
    const setting = map[val] || map[3];
    this.dom.sensitivityValueLabel.textContent = setting.label;
    this.pitchDetector.setSensitivity(setting.rms);
  }

  async populateAudioDevices() {
    const devices = await this.audioController.getAudioInputDevices();
    this.dom.audioDeviceSelect.innerHTML = '';
    if (devices.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'Default Microphone';
      this.dom.audioDeviceSelect.appendChild(opt);
      return;
    }

    devices.forEach((dev, idx) => {
      const opt = document.createElement('option');
      opt.value = dev.deviceId;
      opt.textContent = dev.label || `Microphone ${idx + 1}`;
      if (this.audioController.selectedDeviceId === dev.deviceId) {
        opt.selected = true;
      }
      this.dom.audioDeviceSelect.appendChild(opt);
    });
  }

  async toggleMicrophone() {
    if (this.isListening) {
      this.audioController.stopListening();
      this.isListening = false;
      this.dom.micToggleBtn.classList.remove('recording');
      this.dom.micBtnText.textContent = 'Turn Tuner On';
      this.dom.tuningStatusTag.className = 'tuning-status-tag idle';
      this.dom.tuningStatusTag.textContent = 'Microphone Off';
      this.dom.signalLevelText.textContent = 'Inactive';
      this.gauge.setCents(0, false);
      this.highlightStringCards(null, false);
    } else {
      try {
        await this.audioController.startListening();
        this.pitchDetector.setSampleRate(this.audioController.getSampleRate());
        this.isListening = true;
        this.dom.micToggleBtn.classList.add('recording');
        this.dom.micBtnText.textContent = 'Turn Tuner Off';
        this.dom.tuningStatusTag.className = 'tuning-status-tag listening';
        this.dom.tuningStatusTag.textContent = 'Listening... Play a string';
        this.dom.signalLevelText.textContent = 'Active (Listening)';
        this.hideStatus();
      } catch (err) {
        console.error(err);
        let msg = 'Could not access microphone. Please grant microphone permission in your browser.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = 'Microphone permission was denied. Please allow microphone access in your browser site settings.';
        }
        this.showStatus(msg, 'error');
      }
    }
  }

  showStatus(msg, type = 'info', autoHideMs = 0) {
    this.dom.statusBanner.textContent = msg;
    this.dom.statusBanner.className = `status-banner ${type}`;
    if (autoHideMs > 0) {
      setTimeout(() => this.hideStatus(), autoHideMs);
    }
  }

  hideStatus() {
    this.dom.statusBanner.className = 'status-banner hidden';
  }

  startRenderLoop() {
    const loop = () => {
      if (this.isListening) {
        this.processAudioFrame();
      }
      this.gauge.update();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  processAudioFrame() {
    const audioData = this.audioController.getAudioData();
    const visualData = this.audioController.getVisualizerData();

    if (visualData) {
      this.renderVisualizer(visualData);
    }

    if (!audioData) return;

    const result = this.pitchDetector.detectPitch(audioData);

    if (result.frequency > 0) {
      this.lastPitchTimestamp = performance.now();
      this.handlePitchDetected(result.frequency, result.rms);
    } else {
      // Fade back to listening if silent for more than 400ms
      if (performance.now() - this.lastPitchTimestamp > 450) {
        this.handlePitchDecayed();
      }
    }
  }

  handlePitchDetected(frequency, rms) {
    let targetFrequency = 0;
    let cents = 0;
    let noteName = '--';
    let octave = '';
    let matchedStringIndex = null;

    if (this.tunerMode === 'guitar' && this.selectedStringIndex !== null) {
      // Locked String Mode
      const str = this.currentTuning.strings[this.selectedStringIndex];
      targetFrequency = getFrequency(str.note, str.octave, this.a4Frequency);
      cents = calculateCents(frequency, targetFrequency);
      noteName = str.name || str.note;
      octave = str.octave;
      matchedStringIndex = this.selectedStringIndex;
    } else if (this.tunerMode === 'guitar') {
      // Guitar Auto-String Track Mode
      const closest = findClosestString(frequency, this.currentTuning.strings, this.a4Frequency);
      if (closest) {
        targetFrequency = closest.targetFrequency;
        cents = closest.cents;
        noteName = closest.name || closest.note;
        octave = closest.octave;
        matchedStringIndex = this.currentTuning.strings.findIndex(s => s.num === closest.num);
      }
    } else {
      // Chromatic Mode
      const noteData = frequencyToNote(frequency, this.a4Frequency);
      if (noteData) {
        targetFrequency = noteData.targetFrequency;
        cents = noteData.cents;
        noteName = noteData.note;
        octave = noteData.octave;
      }
    }

    // Update Big Note Display
    this.dom.detectedNote.textContent = noteName;
    this.dom.detectedOctave.textContent = octave !== '' ? octave : '';

    // Update Gauge
    this.gauge.setCents(cents, true);

    // Update Telemetry
    this.dom.detectedFreq.textContent = `${frequency.toFixed(1)} Hz`;
    this.dom.targetFreq.textContent = `${targetFrequency.toFixed(1)} Hz`;
    const roundedCents = Math.round(cents);
    this.dom.centsOffset.textContent = (roundedCents > 0 ? `+${roundedCents}` : `${roundedCents}`) + ' ¢';

    // In Tune / Flat / Sharp Status Tag
    const absCents = Math.abs(cents);
    const inTune = absCents <= 3;

    if (inTune) {
      this.dom.tuningStatusTag.className = 'tuning-status-tag in-tune';
      this.dom.tuningStatusTag.textContent = 'In Tune!';
      this.dom.noteHero.classList.add('in-tune');
    } else if (cents < 0) {
      this.dom.tuningStatusTag.className = 'tuning-status-tag flat';
      this.dom.tuningStatusTag.textContent = `Tune Up (Flat by ${Math.abs(roundedCents)}¢)`;
      this.dom.noteHero.classList.remove('in-tune');
    } else {
      this.dom.tuningStatusTag.className = 'tuning-status-tag sharp';
      this.dom.tuningStatusTag.textContent = `Tune Down (Sharp by ${roundedCents}¢)`;
      this.dom.noteHero.classList.remove('in-tune');
    }

    this.highlightStringCards(matchedStringIndex, inTune);
  }

  handlePitchDecayed() {
    this.dom.tuningStatusTag.className = 'tuning-status-tag listening';
    this.dom.tuningStatusTag.textContent = 'Listening... Play a string';
    this.dom.noteHero.classList.remove('in-tune');
    this.gauge.setCents(0, false);
    this.highlightStringCards(null, false);
  }

  renderVisualizer(freqData) {
    const canvas = this.dom.waveformCanvas;
    const ctx = this.waveCtx;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const barCount = 48;
    const barWidth = (w / barCount) - 2;

    for (let i = 0; i < barCount; i++) {
      const val = freqData[i * 2] || 0;
      const percent = val / 255;
      const barHeight = Math.max(3, percent * (h - 6));
      const x = i * (barWidth + 2);
      const y = h - barHeight;

      const grad = ctx.createLinearGradient(0, y, 0, h);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#0284c7');

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }
}

// Instantiate and start when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new GuitarTunerApp();
  app.init();
  window.tunerApp = app;
});
