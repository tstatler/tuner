/**
 * Main Application Orchestrator
 * Connects Audio Controller, Pitch Detector, Canvas Gauge, Tunings, and UI Events
 */

import { 
  TUNING_PRESETS, 
  getFrequency, 
  frequencyToNote, 
  findClosestString, 
  calculateCents, 
  NOTE_NAMES,
  loadCustomTunings,
  saveCustomTuning,
  deleteCustomTuning,
  getAllTunings
} from './tunings.js';
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
      presetPills: document.querySelectorAll('.pill-btn'),

      // Custom Tuning Controls & Dialog
      addCustomTuningBtn: document.getElementById('addCustomTuningBtn'),
      deleteCustomTuningBtn: document.getElementById('deleteCustomTuningBtn'),
      customTuningDialog: document.getElementById('customTuningDialog'),
      customTuningForm: document.getElementById('customTuningForm'),
      customTuningName: document.getElementById('customTuningName'),
      customTuningTemplate: document.getElementById('customTuningTemplate'),
      customStringCount: document.getElementById('customStringCount'),
      customStringsEditor: document.getElementById('customStringsEditor'),
      closeCustomTuningBtn: document.getElementById('closeCustomTuningBtn'),
      cancelCustomTuningBtn: document.getElementById('cancelCustomTuningBtn')
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

  populateTuningsDropdown(selectedId = null) {
    this.dom.tuningSelect.innerHTML = '';
    const customTunings = loadCustomTunings();

    // 1. Custom Tunings if any exist
    if (customTunings.length > 0) {
      const customGroup = document.createElement('optgroup');
      customGroup.label = '⭐ Custom Tunings';
      customTunings.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        customGroup.appendChild(opt);
      });
      this.dom.tuningSelect.appendChild(customGroup);
    }

    // 2. Built-in Preset Categories
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

    const targetId = selectedId || (this.currentTuning ? this.currentTuning.id : 'standard');
    this.dom.tuningSelect.value = targetId;
    this.updateDeleteButtonVisibility();
  }

  updateDeleteButtonVisibility() {
    if (this.currentTuning && this.currentTuning.isCustom) {
      this.dom.deleteCustomTuningBtn.classList.remove('hidden');
    } else {
      this.dom.deleteCustomTuningBtn.classList.add('hidden');
    }
  }

  openCustomTuningModal() {
    // Populate template selector with built-in presets
    this.dom.customTuningTemplate.innerHTML = '';
    TUNING_PRESETS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      this.dom.customTuningTemplate.appendChild(opt);
    });

    // Default field values
    this.dom.customTuningName.value = '';
    const currentLen = this.currentTuning.strings.length;
    this.dom.customStringCount.value = [4, 5, 6, 7, 8].includes(currentLen) ? currentLen.toString() : '6';

    // Render editor strings
    this.renderCustomStringsEditor(this.currentTuning.strings);

    this.dom.customTuningDialog.showModal();
    this.dom.customTuningName.focus();
  }

  renderCustomStringsEditor(sourceStrings) {
    const count = parseInt(this.dom.customStringCount.value, 10);
    this.dom.customStringsEditor.innerHTML = '';

    const strings = [];
    for (let i = 0; i < count; i++) {
      if (sourceStrings && sourceStrings[i]) {
        strings.push({ ...sourceStrings[i], num: count - i });
      } else {
        strings.push({ num: count - i, note: 'E', octave: Math.min(5, 2 + Math.floor(i / 2)), name: `String ${count - i}` });
      }
    }

    strings.forEach((str, idx) => {
      const row = document.createElement('div');
      row.className = 'custom-string-row';
      row.dataset.index = idx;

      const stringNum = count - idx;
      const initialFreq = getFrequency(str.note, str.octave, this.a4Frequency);

      const noteOptions = NOTE_NAMES.map(n => `<option value="${n}" ${n === str.note ? 'selected' : ''}>${n}</option>`).join('');
      const octaveOptions = [0, 1, 2, 3, 4, 5, 6].map(o => `<option value="${o}" ${o === str.octave ? 'selected' : ''}>Octave ${o}</option>`).join('');

      row.innerHTML = `
        <span class="custom-string-label">String ${stringNum}</span>
        <select class="custom-select compact string-note-input" aria-label="Note for String ${stringNum}">
          ${noteOptions}
        </select>
        <select class="custom-select compact string-octave-input" aria-label="Octave for String ${stringNum}">
          ${octaveOptions}
        </select>
        <span class="custom-string-freq">${initialFreq.toFixed(1)} Hz</span>
        <button type="button" class="custom-string-tone-btn" title="Preview pitch" aria-label="Preview reference pitch for String ${stringNum}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      `;

      const noteSelect = row.querySelector('.string-note-input');
      const octaveSelect = row.querySelector('.string-octave-input');
      const freqLabel = row.querySelector('.custom-string-freq');
      const toneBtn = row.querySelector('.custom-string-tone-btn');

      const updateRowFreq = () => {
        const note = noteSelect.value;
        const oct = parseInt(octSelect.value, 10);
        const f = getFrequency(note, oct, this.a4Frequency);
        freqLabel.textContent = `${f.toFixed(1)} Hz`;
        return f;
      };

      noteSelect.addEventListener('change', updateRowFreq);
      octaveSelect.addEventListener('change', updateRowFreq);

      toneBtn.addEventListener('click', () => {
        const f = updateRowFreq();
        this.audioController.playReferenceTone(f, this.dom.toneTimbreSelect.value, 1.8);
      });

      this.dom.customStringsEditor.appendChild(row);
    });
  }

  saveCustomTuningFromForm() {
    const name = this.dom.customTuningName.value.trim();
    if (!name) return;

    const rows = this.dom.customStringsEditor.querySelectorAll('.custom-string-row');
    const strings = [];
    const count = rows.length;

    rows.forEach((row, idx) => {
      const noteSelect = row.querySelector('.string-note-input');
      const octaveSelect = row.querySelector('.string-octave-input');
      const note = noteSelect.value;
      const octave = parseInt(octaveSelect.value, 10);
      const num = count - idx;
      strings.push({
        num,
        note,
        octave,
        name: `${note}${octave}`
      });
    });

    const newTuning = {
      id: `custom_${Date.now()}`,
      category: '⭐ Custom Tunings',
      name: name,
      isCustom: true,
      strings
    };

    saveCustomTuning(newTuning);
    this.currentTuning = newTuning;
    this.selectedStringIndex = null;
    this.populateTuningsDropdown(newTuning.id);
    this.renderStrings();
    this.dom.customTuningDialog.close();
    this.showStatus(`Saved custom tuning: ${name}`, 'info', 2500);
  }

  deleteCurrentCustomTuning() {
    if (!this.currentTuning || !this.currentTuning.isCustom) return;
    if (confirm(`Are you sure you want to delete custom tuning "${this.currentTuning.name}"?`)) {
      deleteCustomTuning(this.currentTuning.id);
      this.currentTuning = TUNING_PRESETS[0];
      this.selectedStringIndex = null;
      this.populateTuningsDropdown(this.currentTuning.id);
      this.renderStrings();
      this.showStatus('Custom tuning deleted', 'info', 2000);
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

  async playStringReferenceTone(stringObj, frequency, cardEl) {
    const timbre = this.dom.toneTimbreSelect.value;
    cardEl.classList.add('playing');
    try {
      await this.audioController.playReferenceTone(frequency, timbre, 3.0);
    } catch (err) {
      console.error('Error playing string tone:', err);
    }
    setTimeout(() => {
      cardEl.classList.remove('playing');
    }, 3000);
  }

  bindEvents() {
    // Tuning change
    this.dom.tuningSelect.addEventListener('change', (e) => {
      const all = getAllTunings();
      const selected = all.find(t => t.id === e.target.value);
      if (selected) {
        this.currentTuning = selected;
        this.selectedStringIndex = null;
        this.dom.autoDetectStringBtn.classList.add('active');
        this.updateDeleteButtonVisibility();
        this.renderStrings();
      }
    });

    // Custom Tuning Buttons
    this.dom.addCustomTuningBtn.addEventListener('click', () => {
      this.openCustomTuningModal();
    });

    this.dom.deleteCustomTuningBtn.addEventListener('click', () => {
      this.deleteCurrentCustomTuning();
    });

    this.dom.closeCustomTuningBtn.addEventListener('click', () => {
      this.dom.customTuningDialog.close();
    });

    this.dom.cancelCustomTuningBtn.addEventListener('click', () => {
      this.dom.customTuningDialog.close();
    });

    // Custom Tuning Template Preset Change
    this.dom.customTuningTemplate.addEventListener('change', (e) => {
      const preset = TUNING_PRESETS.find(p => p.id === e.target.value);
      if (preset) {
        this.dom.customStringCount.value = preset.strings.length.toString();
        this.renderCustomStringsEditor(preset.strings);
        if (!this.dom.customTuningName.value || this.dom.customTuningName.value.startsWith('Custom:')) {
          this.dom.customTuningName.value = `Custom: ${preset.name.split(' (')[0]}`;
        }
      }
    });

    // Custom Tuning String Count Change
    this.dom.customStringCount.addEventListener('change', () => {
      this.renderCustomStringsEditor(this.currentTuning.strings);
    });

    // Custom Tuning Form Submission
    this.dom.customTuningForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCustomTuningFromForm();
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
    this.dom.playToneBtn.addEventListener('click', async () => {
      try {
        const val = this.dom.toneNoteSelect.value;
        if (!val) return;
        const [note, octStr] = val.split('_');
        const octave = parseInt(octStr, 10);
        const freq = getFrequency(note, octave, this.a4Frequency);
        const timbre = this.dom.toneTimbreSelect.value;

        if (this.toneBtnTimeout) {
          clearTimeout(this.toneBtnTimeout);
        }

        this.dom.playToneBtn.classList.add('hidden');
        this.dom.stopToneBtn.classList.remove('hidden');

        await this.audioController.playReferenceTone(freq, timbre, 3.5);

        this.toneBtnTimeout = setTimeout(() => {
          this.dom.playToneBtn.classList.remove('hidden');
          this.dom.stopToneBtn.classList.add('hidden');
          this.toneBtnTimeout = null;
        }, 3500);
      } catch (err) {
        console.error('Error playing reference tone:', err);
        this.dom.playToneBtn.classList.remove('hidden');
        this.dom.stopToneBtn.classList.add('hidden');
      }
    });

    this.dom.stopToneBtn.addEventListener('click', () => {
      if (this.toneBtnTimeout) {
        clearTimeout(this.toneBtnTimeout);
        this.toneBtnTimeout = null;
      }
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
