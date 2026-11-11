# 🎸 Precision Guitar Tuner

A modern, high-precision web-based guitar and chromatic instrument tuner powered by the HTML5 **Web Audio API** and real-time normalized autocorrelation with McLeod Pitch Method (MPM) peak picking and parabolic interpolation.

![Tuner Preview](https://img.shields.io/badge/Tuning%20Accuracy-±0.01%20cents-10b981?style=for-the-badge)
![Status](https://img.shields.io/badge/Zero%20Dependencies-Pure%20ES%20Modules-38bdf8?style=for-the-badge)

---

## 🌟 Key Features

- **Microphone Pitch Detection**:
  - Sub-cent accuracy with normalized square difference / autocorrelation and parabolic peak refinement.
  - Biquad low-pass pre-filtering to prioritize fundamental frequencies and eliminate harmonic octave doubling on bass strings.
  - Adaptive noise gate with configurable sensitivity slider.
  - Automatic octave-jump protection and temporal median smoothing.
- **Instrument & Chromatic Modes**:
  - **Guitar Mode**: Auto-tracks closest string in selected tuning or allows manual target string locking.
  - **Chromatic Mode**: Displays all 12 semitones across any octave with exact frequency and cents offset.
- **Comprehensive Tuning Presets**:
  - **Guitar (6-String)**: Standard (E A D G B E), Drop D, DADGAD, Open D, Open G, Half-Step Down (Eb), Full-Step Down (D), Drop C, Open E.
  - **Extended Range**: 7-String Standard (B E A D G B E).
  - **Bass**: 4-String Standard (E A D G), 5-String Standard (B E A D G).
  - **Ukulele**: Standard (G C E A).
- **Reference Tone Generator**:
  - Built-in synthesizer with acoustic plucked-string simulation (fundamental + warm harmonics with exponential decay) and pure sine waves.
  - One-click reference tone buttons for each string peg or custom note selector.
- **Visual Feedback & Gauge**:
  - High-DPI canvas arc needle gauge (-50 to +50 cents scale) with smooth physical needle damping.
  - Visual lock with vibrant emerald glow when within ±3 cents ("In Tune!").
  - Real-time frequency spectrum / audio visualizer.
- **Concert Pitch Calibration**:
  - Adjustable A4 reference frequency (415 Hz – 466 Hz, with quick 432 Hz, 440 Hz, and 442 Hz presets).
- **Device & Microphone Selection**:
  - Select between built-in microphones, USB interfaces, and audio pickups.

---

## 🚀 Quick Start

No build tools or heavy dependencies required. Run with any local HTTP server:

### Option 1: Python HTTP Server (Built-in)
```bash
python3 -m http.server 8080
```
Then open your browser at [http://localhost:8080](http://localhost:8080).

### Option 2: Node.js / npx
```bash
npx serve .
```

---

## 🎹 Controls & Shortcuts

| Action | Shortcut / Trigger |
| :--- | :--- |
| **Toggle Microphone Tuner** | `Spacebar` or click **Turn Tuner On** |
| **Play String 1–6 Reference Pitch** | Press keys `1`, `2`, `3`, `4`, `5`, `6` |
| **Lock Target String** | Click any string card |
| **Auto String Tracking** | Click **Auto String Track** button |
| **Switch Mode** | Toggle **Guitar** / **Chromatic** in the header |
| **Open Settings** | Click gear icon (adjust A4 calibration, mic sensitivity, input device) |

---

## 🧪 Running Automated Tests

Run the built-in mathematical accuracy and pitch detector test suite:

```bash
npm test
# or
node test/tuner-math.test.js
```

Verifies:
- Standard string frequencies (E2, A2, D3, G3, B3, E4).
- McLeod Pitch Method peak picking and octave halving suppression.
- Microtonal pitch offset accuracy (< 0.01 cent error margin).

---

## 📁 Project Architecture

```
tuner/
├── index.html           # Main semantic HTML5 interface
├── css/
│   └── style.css        # Responsive dark UI, glassmorphism, responsive grid
├── js/
│   ├── app.js               # Main application coordinator & animation loop
│   ├── pitch-detector.js    # Normalized autocorrelation & MPM pitch detection
│   ├── audio-controller.js  # Web Audio API context, mic stream & tone synth
│   ├── gauge.js             # High-DPI arc needle canvas gauge
│   └── tunings.js           # Pitch math, notes, and tuning presets
├── test/
│   └── tuner-math.test.js   # Unit & microtonal accuracy tests
└── package.json
```
