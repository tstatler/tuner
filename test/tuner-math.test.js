import { TUNING_PRESETS, getFrequency, frequencyToNote, calculateCents, findClosestString } from '../js/tunings.js';
import { PitchDetector } from '../js/pitch-detector.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${message}`);
  }
}

function testTuningsMath() {
  console.log('--- Testing Tunings & Note Math ---');
  const e2 = getFrequency('E', 2, 440);
  assert(Math.abs(e2 - 82.407) < 0.05, `E2 frequency is ~82.41 Hz (got ${e2.toFixed(3)})`);

  const a2 = getFrequency('A', 2, 440);
  assert(Math.abs(a2 - 110.0) < 0.05, `A2 frequency is 110 Hz (got ${a2.toFixed(3)})`);

  const d3 = getFrequency('D', 3, 440);
  assert(Math.abs(d3 - 146.832) < 0.05, `D3 frequency is ~146.83 Hz (got ${d3.toFixed(3)})`);

  const g3 = getFrequency('G', 3, 440);
  assert(Math.abs(g3 - 196.0) < 0.05, `G3 frequency is ~196.00 Hz (got ${g3.toFixed(3)})`);

  const b3 = getFrequency('B', 3, 440);
  assert(Math.abs(b3 - 246.942) < 0.05, `B3 frequency is ~246.94 Hz (got ${b3.toFixed(3)})`);

  const e4 = getFrequency('E', 4, 440);
  assert(Math.abs(e4 - 329.628) < 0.05, `E4 frequency is ~329.63 Hz (got ${e4.toFixed(3)})`);

  // Test frequencyToNote
  const noteA4 = frequencyToNote(440, 440);
  assert(noteA4.note === 'A' && noteA4.octave === 4 && noteA4.cents === 0, '440 Hz accurately detects A4 with 0 cents');

  // Test slightly flat A4 (438 Hz)
  const noteFlat = frequencyToNote(438, 440);
  assert(noteFlat.note === 'A' && noteFlat.octave === 4 && noteFlat.cents < 0, `438 Hz detects A4 flat (cents: ${noteFlat.cents})`);

  // Test findClosestString
  const standardTuning = TUNING_PRESETS.find(t => t.id === 'standard');
  const closestString = findClosestString(83.0, standardTuning.strings, 440);
  assert(closestString.note === 'E' && closestString.num === 6, `83.0 Hz correctly matched to 6th string E2`);
}

function testPitchDetector() {
  console.log('\n--- Testing Pitch Detector with Synthetic Signals ---');
  const sampleRate = 44100;
  const detector = new PitchDetector(sampleRate);
  detector.setSensitivity(0.01);

  // Generate synthetic sine waves for guitar string frequencies
  const testFreqs = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];

  testFreqs.forEach(freq => {
    // Generate 4096 samples of sine wave with slight 2nd harmonic
    const buffer = new Float32Array(4096);
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      // Fundamental + 2nd harmonic
      buffer[i] = 0.7 * Math.sin(2 * Math.PI * freq * t) + 0.2 * Math.sin(2 * Math.PI * (freq * 2) * t);
    }

    const detected = detector.detectPitch(buffer);
    const diffCents = 1200 * Math.log2(detected.frequency / freq);
    assert(Math.abs(diffCents) < 2.0, `Detected ${freq} Hz as ${detected.frequency.toFixed(2)} Hz (error: ${diffCents.toFixed(2)} cents, clarity: ${detected.clarity.toFixed(3)})`);
  });

  console.log('\n--- Testing Microtonal Pitch Offsets (Flat/Sharp Cents Accuracy) ---');
  const baseFreq = 440.0;
  [-25, -10, -3, 0, 3, 10, 25].forEach(centsOffset => {
    const targetFreq = baseFreq * Math.pow(2, centsOffset / 1200);
    const buffer = new Float32Array(4096);
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      buffer[i] = 0.8 * Math.sin(2 * Math.PI * targetFreq * t);
    }
    detector.reset();
    const detected = detector.detectPitch(buffer);
    const detectedCentsOffset = 1200 * Math.log2(detected.frequency / baseFreq);
    const errorInCents = Math.abs(detectedCentsOffset - centsOffset);
    assert(errorInCents < 0.6, `Offset ${centsOffset > 0 ? '+' : ''}${centsOffset}¢ detected as ${detectedCentsOffset.toFixed(2)}¢ (error: ${errorInCents.toFixed(3)}¢)`);
  });
}

testTuningsMath();
testPitchDetector();
console.log('\nAll tuner tests passed successfully!');
